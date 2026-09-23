// محاكاة مصغّرة لـ PostgREST + Auth + Storage تكفي لاختبار الواجهتين بلا شبكة.
// ليست بديلاً عن اختبار قاعدة البيانات الحقيقية (tests/db.test.sql يغطي المنطق المالي والصلاحيات).
const fs = require('fs');
const path = require('path');

const SUPABASE_JS = fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'), 'utf8');
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

function seed() {
    const db = {
        settings: [
            ['store_name', 'بيلا روزا'], ['store_tagline', 'فساتين وملابس أطفال إسبانية بذوق مختلف'], ['store_phone', '0500000000'], ['store_whatsapp', '966500000000'],
            ['store_instagram', 'bellarosa'], ['announcement', 'شحن مجاني للطلبات فوق 500 ر.س'], ['currency', 'ر.س'], ['vat_enabled', '1'], ['vat_rate', '15'],
            ['vat_number', '300000000000003'], ['free_shipping_over', '500'], ['pay_cod', '1'], ['pay_bank', '1'], ['pay_gateway', '0'],
            ['bank_name', 'مصرف الراجحي'], ['bank_account_name', 'مؤسسة بيلا روزا'], ['bank_iban', 'SA0000000000000000000000'],
            ['policy_returns', 'الاستبدال خلال 3 أيام من الاستلام بحالة المنتج الأصلية.'], ['moyasar_publishable_key', ''],
        ].map(([key, value]) => ({ key, value, is_public: true })),
        categories: [
            { id: 'a0000000-0000-4000-8000-000000000001', name: 'فساتين مناسبات', slug: 'occasion-dresses', sort_order: 1, is_active: true },
            { id: 'a0000000-0000-4000-8000-000000000002', name: 'فساتين يومية', slug: 'casual-dresses', sort_order: 2, is_active: true },
            { id: 'a0000000-0000-4000-8000-000000000003', name: 'مواليد (0–24 شهر)', slug: 'baby', sort_order: 3, is_active: true },
            { id: 'a0000000-0000-4000-8000-000000000004', name: 'أطقم وإكسسوارات', slug: 'sets-accessories', sort_order: 4, is_active: true },
        ],
        shipping_rates: ['الرياض', 'جدة', 'مكة المكرمة', 'الدمام', 'مدينة أخرى'].map((city, i) => ({ id: uuid(), city, fee: i < 2 ? 25 : 35, is_active: true, sort_order: i })),
        products: [], product_variants: [], product_images: [], orders: [], order_items: [], order_events: [], stock_movements: [],
        profiles: [{ id: '11111111-1111-4111-8111-111111111111', username: 'bandar', fullname: 'بندر', role: 'admin', is_blocked: false }],
    };
    const P = (n, cat, name, price, cmp, feat, sizes, colors, stock = 3) => {
        const id = `c0000000-0000-4000-8000-00000000000${n}`;
        db.products.push({ id, category_id: db.categories[cat].id, name, description: 'وصف تجريبي للمنتج ' + name, price, compare_at_price: cmp, is_active: true, is_featured: feat, sort_order: n, created_at: new Date(Date.now() - n * 864e5).toISOString(), updated_at: new Date().toISOString() });
        let k = 0;
        for (const s of sizes) for (const c of colors) db.product_variants.push({ id: uuid(), product_id: id, size: s, color: c, sku: null, stock: (n === 1 && s === '2-3 سنوات') ? 0 : stock, price_override: null, is_active: true, sort_order: k++ });
    };
    const AGES = ['2-3 سنوات', '4-5 سنوات', '6-7 سنوات', '8-9 سنوات', '10-11 سنة'];
    const BABY = ['0-3 أشهر', '3-6 أشهر', '6-12 شهر', '12-18 شهر', '18-24 شهر'];
    P(1, 0, 'فستان تول بفيونكة ساتان — وردي', 320, 390, true, AGES, ['']);
    P(2, 0, 'فستان حفلات مطرّز بالترتر — عاجي', 450, null, true, AGES, ['']);
    P(3, 1, 'فستان قطن إسباني مزهّر', 165, null, true, AGES, ['']);
    P(4, 1, 'فستان كتان بحمالات — أزرق سماوي', 145, 180, false, AGES, ['']);
    P(5, 2, 'فستان مواليد قطن بكشكشة', 120, null, true, BABY, [''], 4);
    P(6, 2, 'طقم مواليد: فستان + غطاء رأس', 160, null, false, BABY, [''], 4);
    P(7, 3, 'طقم فستان وبوليرو محبوك', 260, null, false, AGES.slice(0, 3), ['وردي', 'أبيض', 'كحلي'], 2);
    P(8, 3, 'طوق شعر بزهور', 45, 60, false, [''], ['وردي', 'أبيض', 'ذهبي'], 5);
    db.product_images.push({ id: uuid(), product_id: db.products[0].id, path: 'demo/a.png', sort_order: 0 });
    return db;
}

// ----- مفسّر استعلامات مصغّر -----
const CHILDREN = { products: { product_variants: 'product_id', product_images: 'product_id' }, orders: { order_items: 'order_id', order_events: 'order_id' } };
const PARENTS = { product_variants: { products: 'product_id' }, product_images: { products: 'product_id' }, order_items: { products: 'product_id', orders: 'order_id' } };

function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function project(db, table, row, select) {
    if (!select || select === '*') return { ...row };
    const out = {};
    for (const item of splitTop(select)) {
        const m = item.match(/^([a-z_]+)\((.*)\)$/);
        if (!m) { if (item === '*') Object.assign(out, row); else out[item] = row[item]; continue; }
        const [, rel, sub] = m;
        if (CHILDREN[table]?.[rel]) out[rel] = db[rel].filter(r => r[CHILDREN[table][rel]] === row.id).map(r => project(db, rel, r, sub));
        else if (PARENTS[table]?.[rel]) { const p = db[rel].find(r => r.id === row[PARENTS[table][rel]]); out[rel] = p ? project(db, rel, p, sub) : null; }
    }
    return out;
}
function cmp(a, b) { if (a == null) return 1; if (b == null) return -1; return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)); }
function matchOp(val, op, arg) {
    const like = s => new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', 'i');
    switch (op) {
        case 'eq': return String(val) === String(arg);
        case 'neq': return String(val) !== String(arg);
        case 'gt': return val > arg; case 'gte': return val >= arg; case 'lt': return val < arg; case 'lte': return val <= arg;
        case 'in': return arg.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(val));
        case 'ilike': case 'like': return like(arg).test(String(val ?? ''));
        case 'is': return arg === 'null' ? val == null : String(val) === arg;
        default: return true;
    }
}
function applyFilters(rows, params) {
    for (const [k, v] of params) {
        if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
        if (k === 'or') {
            const parts = splitTop(v.replace(/^\(|\)$/g, ''));
            rows = rows.filter(r => parts.some(p => { const [col, op, ...rest] = p.split('.'); return matchOp(r[col], op, rest.join('.')); }));
            continue;
        }
        let [op, ...rest] = v.split('.');
        let neg = false;
        if (op === 'not') { neg = true; op = rest.shift(); }
        const arg = rest.join('.');
        rows = rows.filter(r => neg ? !matchOp(r[k], op, arg) : matchOp(r[k], op, arg));
    }
    return rows;
}
function orderRows(rows, order) {
    if (!order) return rows;
    const keys = order.split(',').map(o => o.split('.'));
    return rows.slice().sort((a, b) => { for (const [col, dir] of keys) { const c = cmp(a[col], b[col]); if (c) return dir === 'desc' ? -c : c; } return 0; });
}

function placeOrder(db, p) {
    const phone = String(p.customer_phone || '');
    if (!/^05\d{8}$/.test(phone)) throw new Error('رقم الجوال غير صحيح (مثال: 05xxxxxxxx)');
    const rate = db.shipping_rates.find(r => r.city === p.city && r.is_active);
    if (!rate) throw new Error('المدينة غير مدعومة للشحن حالياً');
    const setting = k => (db.settings.find(s => s.key === k) || {}).value;
    if (setting({ gateway: 'pay_gateway', bank_transfer: 'pay_bank', cod: 'pay_cod' }[p.payment_method]) !== '1') throw new Error('طريقة الدفع غير متاحة حالياً');
    const id = uuid(); const order_no = 'BR-' + (1001 + db.orders.length);
    let subtotal = 0; const items = [];
    for (const it of p.items) {
        const v = db.product_variants.find(v => v.id === it.variant_id); const pr = v && db.products.find(x => x.id === v.product_id);
        if (!v || !pr) throw new Error('أحد الأصناف لم يعد متاحاً، حدّثي السلة');
        if (v.stock < it.qty) throw new Error(`الكمية المطلوبة من «${pr.name}» غير متوفرة (المتاح: ${v.stock})`);
        v.stock -= it.qty;
        const unit = v.price_override ?? pr.price;
        items.push({ id: uuid(), order_id: id, variant_id: v.id, product_id: pr.id, product_name: pr.name, size: v.size || null, color: v.color || null, unit_price: unit, qty: it.qty, line_total: unit * it.qty });
        subtotal += unit * it.qty;
    }
    let fee = Number(rate.fee); const free = Number(setting('free_shipping_over') || 0); if (free && subtotal >= free) fee = 0;
    const total = subtotal + fee; const vat = Math.round((total - total / 1.15) * 100) / 100;
    const o = { id, order_no, status: 'new', payment_method: p.payment_method, payment_status: p.payment_method === 'gateway' ? 'pending' : 'unpaid', gateway_payment_id: null, customer_name: p.customer_name, customer_phone: phone, customer_email: p.customer_email || null, city: p.city, district: p.district || null, address: p.address, notes: p.notes || null, subtotal, shipping_fee: fee, discount: 0, total, vat_amount: vat, access_token: 'tok' + Math.random().toString(36).slice(2), stock_restored: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), paid_at: null };
    db.orders.push(o); db.order_items.push(...items);
    db.order_events.push({ id: db.order_events.length + 1, order_id: id, event: 'created', details: `${items.length} صنف — ${total} ر.س`, actor_name: 'الزبونة', created_at: o.created_at });
    return { id, order_no, access_token: o.access_token, subtotal, shipping_fee: fee, total, vat_amount: vat, payment_method: p.payment_method };
}
function getOrder(db, no, key) {
    no = String(no || '').toUpperCase(); if (/^\d+$/.test(no)) no = 'BR-' + no;
    const o = db.orders.find(o => o.order_no === no && (o.access_token === key || o.customer_phone === key));
    if (!o) return null;
    const { stock_restored, ...rest } = o;
    return { ...rest, items: db.order_items.filter(i => i.order_id === o.id).map(i => ({ ...i, image: null })), events: db.order_events.filter(e => e.order_id === o.id) };
}

// ----- ربط بالمتصفح -----
async function install(page, db = seed(), { log = () => {} } = {}) {
    await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SUPABASE_JS }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    // محاكاة نموذج Moyasar: زر يعيد التوجيه إلى callback_url مع id/status كما تفعل البوابة
    await page.route(/cdn\.moyasar\.com\/mpf\/.*\.css/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route(/cdn\.moyasar\.com\/mpf\/.*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: `
        window.Moyasar = { init(opts) { window.__moyasarOpts = opts; const el = document.querySelector(opts.element);
            el.innerHTML = '<button type="button" id="mockPay">ادفعي (محاكاة)</button><button type="button" id="mockFail">فشل (محاكاة)</button>';
            const go = async (st) => { await fetch('https://mock.moyasar.local/record', { method: 'POST', body: JSON.stringify({ opts, status: st }) }); const u = new URL(opts.callback_url); u.searchParams.set('id', '11111111-2222-4333-8444-555555555555'); u.searchParams.set('status', st); u.searchParams.set('message', st.toUpperCase()); location.href = u.toString(); };
            el.querySelector('#mockPay').onclick = () => go('paid'); el.querySelector('#mockFail').onclick = () => go('failed'); } };` }));
    await page.route(/mock\.moyasar\.local\/record/, r => { const b = r.request().postDataJSON(); db.__lastPayment = b.opts; db.__lastStatus = b.status; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    await page.route(/supabase\.co\//, async r => {
        const req = r.request(); const u = new URL(req.url()); const m = req.method(); const headers = req.headers();
        const json = (body, status = 200, extra = {}) => r.fulfill({ status, contentType: 'application/json', headers: extra, body: JSON.stringify(body) });
        try {
            log(m, u.pathname + u.search);
            if (u.pathname.startsWith('/auth/v1/token')) {
                const b = req.postDataJSON();
                if (b.email !== 'bandar@users.bellarosa.sa' || b.password !== 'test-pass-1234') return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
                return json({ access_token: 'header.' + Buffer.from(JSON.stringify({ sub: db.profiles[0].id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: db.profiles[0].id, email: b.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
            }
            if (u.pathname.startsWith('/auth/v1/user')) return json({ id: db.profiles[0].id, email: 'bandar@users.bellarosa.sa', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
            if (u.pathname.startsWith('/auth/v1/logout')) return r.fulfill({ status: 204, body: '' });
            if (u.pathname.startsWith('/storage/v1/object/public/')) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 });
            if (u.pathname.startsWith('/storage/v1/object/product-images')) return json({ Key: 'product-images/' + u.pathname.split('product-images/')[1], Id: uuid() });
            if (u.pathname.startsWith('/storage/v1/object/product-images') && m === 'DELETE') return json([]);
            if (u.pathname.startsWith('/functions/v1/moyasar-verify')) {
                const b = req.postDataJSON() || {};
                const o = db.orders.find(x => x.order_no === b.order_no && x.access_token === b.access_token && x.payment_method === 'gateway');
                if (!o) return json({ error: 'الطلب غير موجود' }, 404);
                const opts = db.__lastPayment || {};
                if (opts.metadata?.order_id !== o.id) return json({ error: 'عملية الدفع لا تخص هذا الطلب' }, 400);
                const paid = db.__lastStatus === 'paid' && opts.amount === Math.round(o.total * 100);
                if (paid) { o.payment_status = 'paid'; o.gateway_payment_id = b.payment_id; o.paid_at = new Date().toISOString(); db.order_events.push({ id: db.order_events.length + 1, order_id: o.id, event: 'payment', details: 'paid', actor_name: 'بوابة الدفع', created_at: o.paid_at }); }
                else if (db.__lastStatus === 'failed') { o.payment_status = 'failed'; }
                return json({ ok: true, result: paid ? 'paid' : db.__lastStatus === 'failed' ? 'failed' : 'pending', payment_status: o.payment_status });
            }
            if (u.pathname.startsWith('/rest/v1/rpc/')) {
                const fn = u.pathname.split('/rpc/')[1]; const b = req.postDataJSON() || {};
                if (fn === 'keepalive') return json(new Date().toISOString());
                if (fn === 'place_order') { try { return json(placeOrder(db, b.p)); } catch (e) { return json({ message: e.message, code: 'P0001' }, 400); } }
                if (fn === 'get_order') return json(getOrder(db, b.p_order_no, b.p_key));
                return json({ message: 'unknown rpc' }, 404);
            }
            const table = u.pathname.split('/rest/v1/')[1];
            if (!db[table]) return json({ message: 'no table ' + table }, 404);
            const params = [...u.searchParams.entries()];
            const select = u.searchParams.get('select') || '*';
            const single = (headers.accept || '').includes('vnd.pgrst.object');
            const prefer = headers.prefer || '';
            const respond = rows => { const out = rows.map(x => project(db, table, x, select)); if (single) return out.length === 1 ? json(out[0]) : json({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, 406); return json(out); };
            if (m === 'GET' || m === 'HEAD') {
                let rows = orderRows(applyFilters(db[table], params), u.searchParams.get('order'));
                const total = rows.length;
                if (u.searchParams.get('limit')) rows = rows.slice(0, +u.searchParams.get('limit'));
                if (m === 'HEAD' || prefer.includes('count=exact')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${total}`, 'access-control-expose-headers': 'content-range' }, body: m === 'HEAD' ? '' : JSON.stringify(rows.map(x => project(db, table, x, select))) });
                return respond(rows);
            }
            if (m === 'POST') {
                let body = req.postDataJSON(); const arr = Array.isArray(body) ? body : [body]; const out = [];
                for (const rec of arr) {
                    if (prefer.includes('merge-duplicates') && table === 'settings') { const ex = db.settings.find(s => s.key === rec.key); if (ex) { Object.assign(ex, rec); out.push(ex); continue; } }
                    const row = { id: uuid(), created_at: new Date().toISOString(), ...(table === 'product_variants' ? { stock: 0, is_active: true, size: '', color: '' } : {}), ...rec };
                    db[table].push(row); out.push(row);
                }
                return prefer.includes('return=representation') ? respond(out) : r.fulfill({ status: 201, body: '' });
            }
            if (m === 'PATCH') {
                const rows = applyFilters(db[table], params); const patch = req.postDataJSON();
                for (const row of rows) { if (table === 'orders' && row.status === 'cancelled' && patch.status && patch.status !== 'cancelled') return json({ message: 'لا يمكن إعادة فتح طلب ملغى؛ أنشئ طلباً جديداً', code: 'P0001' }, 400); Object.assign(row, patch); }
                return prefer.includes('return=representation') ? respond(rows) : r.fulfill({ status: 204, body: '' });
            }
            if (m === 'DELETE') {
                const rows = applyFilters(db[table], params); db[table] = db[table].filter(x => !rows.includes(x));
                return prefer.includes('return=representation') ? respond(rows) : r.fulfill({ status: 204, body: '' });
            }
            return json({ message: 'unsupported' }, 400);
        } catch (e) { log('MOCK ERROR', e.message); return json({ message: 'mock error: ' + e.message }, 500); }
    });
    return db;
}
module.exports = { install, seed };
