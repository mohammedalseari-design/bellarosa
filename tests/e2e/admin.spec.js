// اختبار لوحة الإدارة على المحاكاة (تسجيل دخول، اللوحة، الطلبات، المنتجات، التصنيفات، الإعدادات)
const { chromium } = require('playwright');
const { install, seed } = require('./mock_supabase.js');
const path = require('path');
const OUT = process.argv[2] || require('os').tmpdir();
const PORT = process.env.PORT || 8088;
const BASE = `http://127.0.0.1:${PORT}/admin/`;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const db = seed();
    // الحساب الأول يدخل بكلمة مرور مؤقتة ويُجبر على تغييرها
    db.profiles[0].must_change_password = true;
    // طلب تجريبي موجود مسبقاً
    const v = db.product_variants.find(x => x.product_id === db.products[2].id && x.size === '4-5 سنوات');
    const mockLog = [];
    await install(page, db, { log: (...a) => mockLog.push(a.join(' ')) });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    // خطأ 400/422 المتوقع من كلمة مرور خاطئة أو مرفوضة لا يُعدّ عطلاً
    page.on('console', m => { if (m.type() === 'error' && !/400|422/.test(m.text())) errors.push('console: ' + m.text()); });
    const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1; } };

    // إنشاء طلب عبر واجهة المتجر أولاً (نفس المحاكاة)
    await step('seed an order through the storefront', async () => {
        await page.goto(`http://127.0.0.1:${PORT}/#/p/${db.products[2].id}`, { waitUntil: 'networkidle' });
        await page.click('[data-size="4-5 سنوات"]'); await page.click('#addBtn');
        await page.goto(`http://127.0.0.1:${PORT}/#/checkout`);
        await page.waitForSelector('#checkoutForm');
        await page.fill('#f_name', 'نورة'); await page.fill('#f_phone', '0551112222'); await page.selectOption('#f_city', 'الرياض'); await page.fill('#f_address', 'حي النرجس');
        await page.check('input[name=payment_method][value=bank_transfer]');
        await page.click('#submitBtn');
        await page.waitForSelector('.order-no');
        const body = await page.locator('#app').textContent();
        if (!body.includes('SA0000000000000000000000')) throw new Error('IBAN not shown for bank transfer');
        await page.screenshot({ path: path.join(OUT, '07-order-bank.png'), fullPage: true });
    });

    await step('login rejects wrong password', async () => {
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForSelector('#loginForm:not([hidden])');
        await page.fill('#username', 'bandar'); await page.fill('#password', 'wrong');
        await page.click('#loginBtn');
        await page.waitForSelector('#loginError:not([hidden])');
    });

    await step('first login forces a new password (mismatch, too short, then ok)', async () => {
        await page.fill('#password', 'test-pass-1234');
        await page.click('#loginBtn');
        await page.waitForSelector('#pwScreen:not([hidden])');
        if (!(await page.locator('#appShell').isHidden())) throw new Error('app opened before password change');
        await page.fill('#pw1', 'Rosa-2026-new'); await page.fill('#pw2', 'Rosa-2026-neu');
        await page.click('#pwBtn');
        await page.waitForSelector('#pwError:not([hidden])');
        let err = await page.locator('#pwError').textContent();
        if (!err.includes('غير متطابقتين')) throw new Error('mismatch message: ' + err);
        // الأقصر من 8: يمنعه المتصفح (minlength) قبل الإرسال
        await page.fill('#pw1', 'short'); await page.fill('#pw2', 'short');
        await page.click('#pwBtn');
        await page.waitForTimeout(300);
        if (db.__passwordChanges) throw new Error('short password reached the server');
        // نفس كلمة المرور المؤقتة تُرفض من السيرفر
        await page.fill('#pw1', 'test-pass-1234'); await page.fill('#pw2', 'test-pass-1234');
        await page.click('#pwBtn');
        await page.waitForFunction(() => document.querySelector('#pwError')?.textContent.includes('تختلف'));
        await page.screenshot({ path: path.join(OUT, '07b-first-login-password.png'), fullPage: true });
        await page.fill('#pw1', 'Rosa-2026-new'); await page.fill('#pw2', 'Rosa-2026-new');
        await page.click('#pwBtn');
        await page.waitForSelector('#appShell:not([hidden])');
        if (db.__password !== 'Rosa-2026-new') throw new Error('password not stored');
        if (db.profiles[0].must_change_password) throw new Error('must_change_password still true');
    });

    await step('dashboard after login', async () => {
        await page.waitForSelector('#appShell:not([hidden])');
        await page.waitForSelector('.kpi');
        const text = await page.locator('#content').textContent();
        if (!text.includes('بانتظار التأكيد')) throw new Error('kpis missing');
        await page.waitForSelector('#newOrdersPill:not([hidden])');
        const pill = await page.locator('#newOrdersPill').textContent();
        if (pill.trim() !== '1') throw new Error('new orders pill = ' + pill);
        await page.screenshot({ path: path.join(OUT, '08-admin-dashboard.png'), fullPage: true });
    });

    await step('orders: open, confirm, mark paid', async () => {
        await page.goto(BASE + '#/orders');
        await page.waitForSelector('tr.clickable');
        await page.click('tr.clickable');
        await page.waitForSelector('#oSave');
        await page.selectOption('#oStatus', 'confirmed');
        await page.selectOption('#oPay', 'paid');
        await page.screenshot({ path: path.join(OUT, '09-admin-order.png'), fullPage: true });
        await page.click('#oSave');
        await page.waitForSelector('#modal', { state: 'hidden' });
        await page.waitForSelector('tr.clickable');
        const row = await page.locator('tr.clickable').first().textContent();
        if (!row.includes('مؤكد') || !row.includes('مدفوع')) throw new Error('row not updated: ' + row);
        const pillHidden = await page.locator('#newOrdersPill').isHidden();
        if (!pillHidden) throw new Error('pill should hide');
    });

    await step('orders: add note + cancel restores nothing twice', async () => {
        await page.click('tr.clickable');
        await page.waitForSelector('#noteForm');
        await page.fill('#noteForm input', 'اتصلت بالزبونة وأكدت');
        await page.click('#noteForm button');
        await page.waitForFunction(() => document.querySelector('.timeline')?.textContent.includes('اتصلت بالزبونة'));
        await page.click('#oCancel');
        await page.waitForSelector('#cYes');
        await page.click('#cYes');
        await page.waitForSelector('#modal', { state: 'hidden' });
        await page.waitForFunction(() => document.querySelector('tr.clickable')?.textContent.includes('ملغى'), null, { timeout: 15000 });
        if (db.orders[0].status !== 'cancelled') throw new Error('mock order not cancelled');
    });

    await step('products: list + editor + add variant + save', async () => {
        await page.goto(BASE + '#/products');
        await page.waitForSelector('tr.clickable');
        const n = await page.locator('tr.clickable').count();
        if (n !== 8) throw new Error('products=' + n);
        await page.click('tr.clickable >> nth=0');
        await page.waitForSelector('#productForm');
        const rows = await page.locator('#variantRows tr').count();
        if (rows !== 5) throw new Error('variants=' + rows);
        await page.click('#addVariant');
        const last = page.locator('#variantRows tr').last();
        await last.locator('[name=size]').fill('12 سنة');
        await last.locator('[name=stock]').fill('2');
        await page.fill('[name=compare_at_price]', '420');
        await page.screenshot({ path: path.join(OUT, '10-admin-product-editor.png'), fullPage: true });
        await page.click('#saveProduct');
        await page.waitForSelector('#modal', { state: 'hidden' });
        await page.waitForSelector('tr.clickable');
        const p = db.products[0];
        const xxl = db.product_variants.find(v => v.product_id === p.id && v.size === '12 سنة');
        if (!xxl || xxl.stock !== 2) throw new Error('variant not saved');
        if (Number(p.compare_at_price) !== 420) throw new Error('compare price not saved');
    });

    await step('products: duplicate variant rejected', async () => {
        await page.click('tr.clickable >> nth=1');
        await page.waitForSelector('#productForm');
        await page.click('#addVariant');
        await page.locator('#variantRows tr').last().locator('[name=size]').fill('4-5 سنوات');
        await page.click('#saveProduct');
        await page.waitForSelector('#formError:not([hidden])');
        const t = await page.locator('#formError').textContent();
        if (!t.includes('نفس المقاس')) throw new Error(t);
        await page.click('#cancelEdit');
    });

    await step('products: new product with image upload', async () => {
        await page.click('#newProduct');
        await page.waitForSelector('#productForm');
        await page.fill('[name=name]', 'فستان جديد للاختبار');
        await page.fill('[name=price]', '350');
        await page.click('#addSizes');
        const rows = await page.locator('#variantRows tr').count();
        if (rows !== 5) throw new Error('sizes rows=' + rows);
        // صورة PNG صغيرة
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FAAAWOAJ9RbW3pwAAAABJRU5ErkJggg==', 'base64');
        await page.setInputFiles('#imageInput', { name: 'a.png', mimeType: 'image/png', buffer: png });
        await page.waitForSelector('.img-item');
        await page.click('#saveProduct');
        await page.waitForSelector('#modal', { state: 'hidden' });
        const p = db.products.find(x => x.name === 'فستان جديد للاختبار');
        if (!p) throw new Error('product not inserted');
        if (db.product_variants.filter(v => v.product_id === p.id).length !== 5) throw new Error('variants not inserted');
        if (db.product_images.filter(i => i.product_id === p.id).length !== 1) throw new Error('image row not inserted');
        if (!mockLog.some(l => l.includes('POST /storage/v1/object/product-images/' + p.id))) throw new Error('image not uploaded');
    });

    await step('categories: add one', async () => {
        await page.goto(BASE + '#/categories');
        await page.waitForSelector('#addRow');
        await page.click('#addRow');
        await page.waitForSelector('#rowForm');
        await page.fill('[name=name]', 'أطقم');
        await page.fill('[name=sort_order]', '5');
        await page.click('#rowForm button[type=submit]');
        await page.waitForSelector('#modal', { state: 'hidden' });
        if (!db.categories.find(c => c.name === 'أطقم')) throw new Error('category not added');
    });

    await step('settings: save', async () => {
        await page.goto(BASE + '#/settings');
        await page.waitForSelector('#settingsForm');
        await page.fill('[name=announcement]', 'تخفيضات نهاية الموسم');
        await page.click('#settingsForm button[type=submit]');
        await page.waitForSelector('.toast.show');
        if (db.settings.find(s => s.key === 'announcement').value !== 'تخفيضات نهاية الموسم') throw new Error('setting not saved');
        await page.screenshot({ path: path.join(OUT, '11-admin-settings.png'), fullPage: true });
    });

    await step('mobile admin screenshot', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(BASE + '#/orders');
        await page.waitForSelector('tr.clickable');
        await page.screenshot({ path: path.join(OUT, '12-admin-mobile.png'), fullPage: false });
    });

    await step('change password from the topbar', async () => {
        await page.setViewportSize({ width: 1280, height: 860 });
        await page.click('#changePwBtn');
        await page.waitForSelector('#pwModalForm');
        await page.fill('#mpw1', 'Rosa-2026-two'); await page.fill('#mpw2', 'Rosa-2026-two');
        await page.click('#mpwSave');
        await page.waitForSelector('#modal', { state: 'hidden' });
        if (db.__password !== 'Rosa-2026-two') throw new Error('password not changed');
    });

    await step('logout + login with the new password', async () => {
        await page.click('#logoutBtn');
        await page.waitForSelector('#loginScreen:not([hidden])');
        await page.fill('#username', 'bandar'); await page.fill('#password', 'test-pass-1234');
        await page.click('#loginBtn');
        await page.waitForSelector('#loginError:not([hidden])');
        await page.fill('#password', 'Rosa-2026-two');
        await page.click('#loginBtn');
        await page.waitForSelector('#appShell:not([hidden])');
        if (!(await page.locator('#pwScreen').isHidden())) throw new Error('password screen shown again');
        await page.click('#logoutBtn');
        await page.waitForSelector('#loginScreen:not([hidden])');
    });

    if (errors.length) { console.log('BROWSER ERRORS:'); errors.forEach(e => console.log('  ', e)); process.exitCode = 1; }
    await browser.close();
})();
