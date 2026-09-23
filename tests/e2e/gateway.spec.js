// اختبار مسار الدفع الإلكتروني على المحاكاة: نموذج الدفع → العودة → التحقق في السيرفر → «مدفوع»
const { chromium } = require('playwright');
const { install, seed } = require('./mock_supabase.js');
const path = require('path');
const OUT = process.argv[2] || require('os').tmpdir();
const PORT = process.env.PORT || 8088;
const BASE = `http://127.0.0.1:${PORT}/`;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const db = seed();
    db.settings.find(s => s.key === 'pay_gateway').value = '1';
    db.settings.find(s => s.key === 'moyasar_publishable_key').value = 'pk_test_mock';
    await install(page, db);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1; } };

    await step('checkout offers the gateway first and creates a pending order', async () => {
        await page.goto(BASE + '#/p/c0000000-0000-4000-8000-000000000003', { waitUntil: 'networkidle' });
        await page.click('[data-size="L"]'); await page.click('#addBtn');
        await page.goto(BASE + '#/checkout'); await page.waitForSelector('#checkoutForm');
        const first = await page.locator('input[name=payment_method]').first().getAttribute('value');
        if (first !== 'gateway') throw new Error('first method ' + first);
        await page.fill('#f_name', 'سارة'); await page.fill('#f_phone', '0559998888'); await page.selectOption('#f_city', 'الرياض'); await page.fill('#f_address', 'حي الملقا');
        await page.click('#submitBtn');
        await page.waitForSelector('#mysrForm #mockPay', { timeout: 15000 });
        if (db.orders[0].payment_status !== 'pending') throw new Error('status ' + db.orders[0].payment_status);
        const opts = await page.evaluate(() => window.__moyasarOpts);
        if (opts.amount !== 26500 || opts.currency !== 'SAR' || opts.metadata.order_id !== db.orders[0].id) throw new Error('init opts ' + JSON.stringify(opts));
        if (!opts.callback_url.includes('?pay=BR-1001&t=')) throw new Error('callback ' + opts.callback_url);
        await page.screenshot({ path: path.join(OUT, '13-order-gateway.png'), fullPage: true });
    });

    await step('failed payment keeps the order payable', async () => {
        await page.click('#mockFail');
        await page.waitForFunction(() => document.querySelector('#gatewayBox')?.textContent.includes('لم تكتمل') && document.querySelector('#mockPay'), null, { timeout: 15000 });
        if (db.orders[0].payment_status !== 'failed') throw new Error('status ' + db.orders[0].payment_status);
        if (!(await page.evaluate(() => location.hash)).startsWith('#/order/BR-1001?t=')) throw new Error('hash ' + await page.evaluate(() => location.hash));
        if ((await page.evaluate(() => location.search)) !== '') throw new Error('search not cleaned');
    });

    await step('successful payment is verified server-side and shown as paid', async () => {
        await page.click('#mockPay');
        await page.waitForFunction(() => document.querySelector('.pay-box')?.textContent.includes('تم استلام الدفع'), null, { timeout: 15000 });
        if (db.orders[0].payment_status !== 'paid') throw new Error('status ' + db.orders[0].payment_status);
        const body = await page.locator('#app').textContent();
        if (!body.includes('مدفوع')) throw new Error('badge');
        await page.screenshot({ path: path.join(OUT, '14-order-paid.png'), fullPage: true });
    });

    if (errors.length) { console.log('BROWSER ERRORS:'); errors.forEach(e => console.log('  ', e)); process.exitCode = 1; }
    await browser.close();
})();
