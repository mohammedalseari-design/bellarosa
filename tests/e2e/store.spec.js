// اختبار رحلة الشراء كاملة في واجهة المتجر على محاكاة Supabase المحلية (tests/e2e/mock_supabase.js)
const { chromium } = require('playwright');
const { install } = require('./mock_supabase.js');
const path = require('path');
const OUT = process.argv[2] || require('os').tmpdir();
const PORT = process.env.PORT || 8088;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await install(page);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1; } };

    await step('home loads with products', async () => {
        await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
        await page.waitForSelector('.product-card', { timeout: 15000 });
        const n = await page.locator('.product-card').count();
        if (n < 4) throw new Error('only ' + n + ' cards');
        await page.screenshot({ path: path.join(OUT, '01-home-mobile.png'), fullPage: true });
    });

    await step('shop filter by category', async () => {
        await page.goto(BASE + '#/shop?cat=abayas', { waitUntil: 'networkidle' });
        await page.waitForSelector('.product-card');
        const n = await page.locator('.product-card').count();
        if (n !== 2) throw new Error('expected 2 abayas, got ' + n);
        const h1 = await page.locator('h1').first().textContent();
        if (!h1.includes('عبايات')) throw new Error('h1=' + h1);
    });

    await step('product page: size selection + add to cart', async () => {
        await page.goto(BASE + '#/p/c0000000-0000-4000-8000-000000000001', { waitUntil: 'networkidle' });
        await page.waitForSelector('#addBtn');
        if (!(await page.locator('#addBtn').isDisabled())) throw new Error('add enabled before size chosen');
        const sDisabled = await page.locator('[data-size="S"]').isDisabled();
        if (!sDisabled) throw new Error('size S (out of stock) should be disabled');
        await page.click('[data-size="M"]');
        await page.click('#qtyPlus');
        if ((await page.locator('#qtyVal').textContent()) !== '2') throw new Error('qty not 2');
        await page.click('#addBtn');
        await page.waitForSelector('.toast.show');
        const badge = await page.locator('#cartCount').textContent();
        if (badge !== '2') throw new Error('cart badge=' + badge);
        await page.screenshot({ path: path.join(OUT, '02-product-mobile.png'), fullPage: true });
    });

    await step('second product to cart (skirt, color only)', async () => {
        await page.goto(BASE + '#/p/c0000000-0000-4000-8000-000000000008', { waitUntil: 'networkidle' });
        await page.waitForSelector('#addBtn');
        await page.click('[data-color="بيج"]');
        await page.click('#addBtn');
        await page.waitForSelector('.toast.show');
    });

    await step('cart totals', async () => {
        await page.goto(BASE + '#/cart', { waitUntil: 'networkidle' });
        await page.waitForSelector('.cart-line');
        const lines = await page.locator('.cart-line').count();
        if (lines !== 2) throw new Error('lines=' + lines);
        const total = await page.locator('.summary-row.total .price').textContent();
        if (!total.replace(/,/g, '').startsWith('1970')) throw new Error('subtotal shown ' + total); // 890*2 + 190
        await page.screenshot({ path: path.join(OUT, '03-cart-mobile.png'), fullPage: true });
    });

    let orderNo = null;
    await step('checkout places a COD order', async () => {
        await page.goto(BASE + '#/checkout', { waitUntil: 'networkidle' });
        await page.waitForSelector('#checkoutForm');
        await page.fill('#f_name', 'زبونة تجريبية');
        await page.fill('#f_phone', '٠٥٥ ١٢٣ ٤٥٦٧');
        await page.selectOption('#f_city', 'جدة');
        await page.fill('#f_district', 'الروضة');
        await page.fill('#f_address', 'شارع الأمير سلطان، عمارة 5');
        await page.check('input[name=payment_method][value=cod]');
        const feeText = await page.locator('#summaryBox').textContent();
        if (!feeText.includes('مجاني') || !feeText.includes('1,970')) throw new Error('free shipping total not shown: ' + feeText);
        await page.screenshot({ path: path.join(OUT, '04-checkout-mobile.png'), fullPage: true });
        await page.click('#submitBtn');
        await page.waitForSelector('.order-no', { timeout: 20000 });
        orderNo = (await page.locator('.order-no').textContent()).trim();
        if (!/^BR-\d+$/.test(orderNo)) throw new Error('order no ' + orderNo);
        const body = await page.locator('#app').textContent();
        if (!body.includes('1,970')) throw new Error('order total missing');
        if (!body.includes('الدفع عند الاستلام')) throw new Error('COD box missing');
        await page.screenshot({ path: path.join(OUT, '05-order-mobile.png'), fullPage: true });
        console.log('     order:', orderNo);
    });

    await step('cart emptied after order', async () => {
        const badgeHidden = await page.locator('#cartCount').isHidden();
        if (!badgeHidden) throw new Error('badge still visible');
    });

    await step('track order by phone', async () => {
        await page.goto(BASE + '#/track', { waitUntil: 'networkidle' });
        await page.fill('#t_no', orderNo.replace('BR-', ''));
        await page.fill('#t_phone', '0551234567');
        await page.click('#trackForm button[type=submit]');
        await page.waitForSelector('.order-no', { timeout: 15000 });
        const no = (await page.locator('.order-no').textContent()).trim();
        if (no !== orderNo) throw new Error('tracked ' + no);
    });

    await step('wrong phone is rejected', async () => {
        await page.goto(BASE + `#/order/${orderNo}?k=0500000000`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.empty', { timeout: 15000 });
    });

    await step('desktop home screenshot', async () => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
        await page.waitForSelector('.product-card');
        await page.screenshot({ path: path.join(OUT, '06-home-desktop.png'), fullPage: false });
    });

    if (errors.length) { console.log('BROWSER ERRORS:'); errors.forEach(e => console.log('  ', e)); process.exitCode = 1; }
    console.log('ORDER_NO=' + orderNo);
    await browser.close();
})();
