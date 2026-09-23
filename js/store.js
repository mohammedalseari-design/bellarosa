// بيلا روزا — واجهة المتجر (صفحة واحدة، مسارات بالـ hash).
// القراءة من Supabase بالمفتاح العام تحت RLS، وإنشاء الطلب عبر دالة place_order في السيرفر.
// لا تُحسب أي مبالغ نهائية هنا؛ ما يُعرض قبل الطلب تقديري، والسيرفر هو المرجع.

const CFG = window.BELLAROSA_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);

const state = {
    settings: {},
    categories: [],
    products: [],
    shipping: [],
    loaded: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');

// ---------- أدوات ----------
export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function money(n) {
    const v = Number(n || 0);
    return `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}<span class="cur">${esc(state.settings.currency || 'ر.س')}</span>`;
}
function imgUrl(path) {
    return `${CFG.SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}
const PLACEHOLDER = `<div class="placeholder" aria-hidden="true"><svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M32 40c-6-2-9-7-6-12 2-3 6-3 8 0 2-3 6-3 8 0 3 5 0 10-6 12"/><path d="M32 40c-3-3-3-8 0-11 3 3 3 8 0 11z"/><path d="M32 40v10"/></g></svg></div>`;
function productImage(p, cls = '') {
    const im = (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order)[0];
    return im ? `<img src="${esc(imgUrl(im.path))}" alt="${esc(p.name)}" loading="lazy" class="${cls}">` : PLACEHOLDER;
}
function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = 'toast', 2800);
}
function navigate(hash) { location.hash = hash; }
function waLink(text) {
    const n = (state.settings.store_whatsapp || '').replace(/\D/g, '');
    if (!n) return '';
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
function digits(s) { return String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }
export function normalizePhone(s) {
    const d = digits(s).replace(/\D/g, '');
    if (/^05\d{8}$/.test(d)) return d;
    if (/^5\d{8}$/.test(d)) return '0' + d;
    if (/^9665\d{8}$/.test(d)) return '0' + d.slice(3);
    if (/^009665\d{8}$/.test(d)) return '0' + d.slice(5);
    return null;
}

// ---------- السلة (localStorage) ----------
const CART_KEY = 'bellarosa_cart';
export const cart = {
    items: [],
    load() {
        try { this.items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { this.items = []; }
        if (!Array.isArray(this.items)) this.items = [];
    },
    save() {
        try { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); } catch { /* التخزين غير متاح — السلة في الذاكرة فقط */ }
        updateCartBadge();
    },
    add(variantId, productId, qty) {
        const line = this.items.find(i => i.variant_id === variantId);
        if (line) line.qty = Math.min(10, line.qty + qty); else this.items.push({ variant_id: variantId, product_id: productId, qty });
        this.save();
    },
    setQty(variantId, qty) {
        const line = this.items.find(i => i.variant_id === variantId);
        if (!line) return;
        line.qty = Math.max(1, Math.min(10, qty));
        this.save();
    },
    remove(variantId) { this.items = this.items.filter(i => i.variant_id !== variantId); this.save(); },
    clear() { this.items = []; this.save(); },
    count() { return this.items.reduce((s, i) => s + i.qty, 0); },
    // يحوّل السطور إلى بيانات كاملة من الكتالوج ويحذف ما لم يعد موجوداً
    lines() {
        const out = [];
        for (const l of this.items) {
            const p = state.products.find(p => p.id === l.product_id);
            const v = p && p.product_variants.find(v => v.id === l.variant_id);
            if (!p || !v || !v.is_active) continue;
            const unit = v.price_override ?? p.price;
            out.push({ ...l, product: p, variant: v, unit, total: unit * l.qty, available: v.stock });
        }
        return out;
    },
};
function updateCartBadge() {
    const n = cart.count();
    const el = $('#cartCount');
    el.textContent = n;
    el.hidden = n === 0;
}

// ---------- تحميل البيانات ----------
async function loadCatalog() {
    const [s, c, p, sh] = await Promise.all([
        sb.from('settings').select('key,value'),
        sb.from('categories').select('*').order('sort_order'),
        sb.from('products').select('*, product_variants(*), product_images(*)').order('sort_order').order('created_at', { ascending: false }),
        sb.from('shipping_rates').select('*').order('sort_order'),
    ]);
    for (const r of [s, c, p, sh]) if (r.error) throw r.error;
    state.settings = Object.fromEntries(s.data.map(r => [r.key, r.value]));
    state.categories = c.data;
    state.products = p.data.map(pr => ({
        ...pr,
        product_variants: (pr.product_variants || []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order),
        product_images: (pr.product_images || []).sort((a, b) => a.sort_order - b.sort_order),
    }));
    state.shipping = sh.data;
    state.loaded = true;
    applySettings();
}
function applySettings() {
    const st = state.settings;
    document.title = `${st.store_name || 'بيلا روزا'} — ${st.store_tagline || ''}`;
    $('.brand-name').textContent = st.store_name || 'بيلا روزا';
    $('.footer-brand').textContent = st.store_name || 'بيلا روزا';
    $('#footerTagline').textContent = st.store_tagline || '';
    const ann = $('#announce');
    ann.textContent = st.announcement || '';
    ann.hidden = !st.announcement;
    const contact = [];
    if (st.store_phone) contact.push(`<a href="tel:${esc(st.store_phone)}">📞 ${esc(st.store_phone)}</a>`);
    if (st.store_whatsapp) contact.push(`<a href="${esc(waLink('مرحباً، لدي استفسار'))}" target="_blank" rel="noopener">💬 واتساب</a>`);
    if (st.store_instagram) contact.push(`<a href="https://instagram.com/${esc(st.store_instagram.replace('@', ''))}" target="_blank" rel="noopener">📸 ${esc(st.store_instagram)}</a>`);
    $('#footerContact').innerHTML = contact.join('');
    $('#footerVat').textContent = st.vat_number ? `الرقم الضريبي: ${st.vat_number}` : '';
    const wa = $('#waFloat');
    if (st.store_whatsapp) { wa.href = waLink('مرحباً، لدي استفسار عن منتجاتكم'); wa.hidden = false; }
}
function productStock(p) { return p.product_variants.reduce((s, v) => s + v.stock, 0); }

// ---------- الصفحات ----------
function cardHTML(p) {
    const out = productStock(p) === 0;
    const sale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price);
    return `<a class="card product-card" href="#/p/${esc(p.id)}">
        <div class="product-media">${productImage(p)}
            ${out ? '<span class="badge badge-out">نفد</span>' : sale ? `<span class="badge badge-sale">خصم ${Math.round((1 - p.price / p.compare_at_price) * 100)}٪</span>` : ''}
        </div>
        <div class="product-body">
            <div class="product-name">${esc(p.name)}</div>
            <div class="price">${money(p.price)}${sale ? `<span class="price-old">${money(p.compare_at_price)}</span>` : ''}</div>
        </div>
    </a>`;
}
function gridHTML(list) {
    if (!list.length) return `<div class="empty">لا توجد منتجات هنا حالياً.<br><a class="btn btn-outline" href="#/shop">تصفّحي المتجر</a></div>`;
    return `<div class="grid">${list.map(cardHTML).join('')}</div>`;
}

function renderHome() {
    const st = state.settings;
    const featured = state.products.filter(p => p.is_featured);
    const latest = state.products.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
    app.innerHTML = `
    <section class="hero">
        <h1>${esc(st.store_name || 'بيلا روزا')}</h1>
        <p>${esc(st.store_tagline || '')}</p>
        <a class="btn btn-primary" href="#/shop">تسوّقي الآن</a>
    </section>
    <section class="section">
        <div class="cats">${state.categories.map(c => `<a class="chip" href="#/shop?cat=${esc(c.slug || c.id)}">${esc(c.name)}</a>`).join('')}</div>
    </section>
    ${featured.length ? `<section class="section"><div class="section-head"><h2>مختارات بيلا روزا</h2><a href="#/shop">عرض الكل</a></div>${gridHTML(featured)}</section>` : ''}
    <section class="section"><div class="section-head"><h2>وصل حديثاً</h2><a href="#/shop">عرض الكل</a></div>${gridHTML(latest)}</section>`;
}

function renderShop(params) {
    const cat = params.get('cat') || '';
    const q = (params.get('q') || '').trim();
    const sort = params.get('sort') || 'new';
    let list = state.products.slice();
    const category = state.categories.find(c => c.slug === cat || c.id === cat);
    if (category) list = list.filter(p => p.category_id === category.id);
    if (q) list = list.filter(p => (p.name + ' ' + (p.description || '')).includes(q));
    if (sort === 'asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'desc') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => a.sort_order - b.sort_order || new Date(b.created_at) - new Date(a.created_at));

    app.innerHTML = `
    <section class="section">
        <h1>${category ? esc(category.name) : 'المتجر'}</h1>
        <div class="cats">
            <a class="chip ${!category ? 'active' : ''}" href="#/shop">الكل</a>
            ${state.categories.map(c => `<a class="chip ${category && category.id === c.id ? 'active' : ''}" href="#/shop?cat=${esc(c.slug || c.id)}">${esc(c.name)}</a>`).join('')}
        </div>
        <form class="toolbar" id="shopForm">
            <input type="search" name="q" value="${esc(q)}" placeholder="ابحثي عن فستان أو طقم…" aria-label="بحث">
            <select name="sort" aria-label="الترتيب">
                <option value="new" ${sort === 'new' ? 'selected' : ''}>الأحدث</option>
                <option value="asc" ${sort === 'asc' ? 'selected' : ''}>السعر: من الأقل</option>
                <option value="desc" ${sort === 'desc' ? 'selected' : ''}>السعر: من الأعلى</option>
            </select>
            <button class="btn btn-dark btn-sm" type="submit">بحث</button>
        </form>
        ${gridHTML(list)}
    </section>`;
    $('#shopForm').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const p = new URLSearchParams();
        if (category) p.set('cat', category.slug || category.id);
        if (fd.get('q')) p.set('q', fd.get('q'));
        if (fd.get('sort') !== 'new') p.set('sort', fd.get('sort'));
        navigate('#/shop' + (p.toString() ? '?' + p : ''));
    });
    $('#shopForm select').addEventListener('change', () => $('#shopForm').requestSubmit());
}

function renderProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) { app.innerHTML = `<div class="empty">المنتج غير موجود.<br><a class="btn btn-outline" href="#/shop">العودة للمتجر</a></div>`; return; }
    const sizes = [...new Set(p.product_variants.map(v => v.size).filter(Boolean))];
    const colors = [...new Set(p.product_variants.map(v => v.color).filter(Boolean))];
    const sel = { size: sizes.length === 1 ? sizes[0] : '', color: colors.length === 1 ? colors[0] : '', qty: 1 };
    const sale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price);
    const images = p.product_images;

    const variantFor = (size, color) => p.product_variants.find(v => (v.size || '') === (size || '') && (v.color || '') === (color || ''));
    const anyStock = (size, color) => p.product_variants.some(v =>
        (size === undefined || (v.size || '') === (size || '')) && (color === undefined || (v.color || '') === (color || '')) && v.stock > 0);

    app.innerHTML = `
    <div class="product-page">
        <div class="gallery">
            <div class="gallery-main" id="galleryMain">${images.length ? `<img src="${esc(imgUrl(images[0].path))}" alt="${esc(p.name)}">` : PLACEHOLDER}</div>
            ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((im, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="صورة ${i + 1}"><img src="${esc(imgUrl(im.path))}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="product-info">
            <p class="muted small">${esc((state.categories.find(c => c.id === p.category_id) || {}).name || '')}</p>
            <h1>${esc(p.name)}</h1>
            <div class="price">${money(p.price)}${sale ? `<span class="price-old">${money(p.compare_at_price)}</span>` : ''}</div>
            <p class="muted small">شامل ضريبة القيمة المضافة</p>
            ${sizes.length ? `<div class="opt-group"><div class="opt-label"><span>المقاس / العمر</span></div><div class="opts" id="sizeOpts">${sizes.map(s => `<button type="button" class="opt ${sel.size === s ? 'active' : ''}" data-size="${esc(s)}" ${anyStock(s, undefined) ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div></div>` : ''}
            ${colors.length ? `<div class="opt-group"><div class="opt-label"><span>اللون</span></div><div class="opts" id="colorOpts">${colors.map(c => `<button type="button" class="opt ${sel.color === c ? 'active' : ''}" data-color="${esc(c)}" ${anyStock(undefined, c) ? '' : 'disabled'}>${esc(c)}</button>`).join('')}</div></div>` : ''}
            <div class="opt-group"><div class="opt-label"><span>الكمية</span></div>
                <div class="qty"><button type="button" id="qtyMinus" aria-label="أقل">−</button><span id="qtyVal">1</span><button type="button" id="qtyPlus" aria-label="أكثر">+</button></div>
                <div class="stock-note" id="stockNote"></div>
            </div>
            <div class="buy-row">
                <button class="btn btn-primary" id="addBtn" type="button">أضيفي إلى السلة</button>
                ${state.settings.store_whatsapp ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(waLink(`مرحباً، أستفسر عن: ${p.name}\n${location.href}`))}">استفسار واتساب</a>` : ''}
            </div>
            ${p.description ? `<div class="opt-group"><h3>الوصف</h3><div class="product-desc">${esc(p.description)}</div></div>` : ''}
            <p class="muted small">${esc(state.settings.policy_returns || '')}</p>
        </div>
    </div>`;

    const refresh = () => {
        const v = variantFor(sel.size, sel.color);
        const note = $('#stockNote');
        const btn = $('#addBtn');
        const needs = (sizes.length && !sel.size) || (colors.length && !sel.color);
        if (needs) { note.textContent = 'اختاري ' + [sizes.length && !sel.size ? 'المقاس' : '', colors.length && !sel.color ? 'اللون' : ''].filter(Boolean).join(' و'); note.className = 'stock-note muted'; btn.disabled = true; return; }
        if (!v || v.stock === 0) { note.textContent = 'هذا الخيار غير متوفر حالياً'; note.className = 'stock-note'; note.style.color = 'var(--danger)'; btn.disabled = true; return; }
        note.style.color = '';
        note.className = 'stock-note ' + (v.stock <= 2 ? '' : 'muted');
        note.textContent = v.stock <= 2 ? `متبقٍ ${v.stock} فقط` : 'متوفر';
        if (sel.qty > v.stock) { sel.qty = v.stock; $('#qtyVal').textContent = sel.qty; }
        btn.disabled = false;
    };
    $('#sizeOpts')?.addEventListener('click', e => {
        const b = e.target.closest('[data-size]'); if (!b) return;
        sel.size = b.dataset.size;
        $('#sizeOpts').querySelectorAll('.opt').forEach(o => o.classList.toggle('active', o === b));
        refresh();
    });
    $('#colorOpts')?.addEventListener('click', e => {
        const b = e.target.closest('[data-color]'); if (!b) return;
        sel.color = b.dataset.color;
        $('#colorOpts').querySelectorAll('.opt').forEach(o => o.classList.toggle('active', o === b));
        refresh();
    });
    $('#qtyMinus').addEventListener('click', () => { sel.qty = Math.max(1, sel.qty - 1); $('#qtyVal').textContent = sel.qty; });
    $('#qtyPlus').addEventListener('click', () => {
        const v = variantFor(sel.size, sel.color);
        sel.qty = Math.min(10, v ? Math.min(v.stock, sel.qty + 1) : sel.qty + 1);
        $('#qtyVal').textContent = sel.qty;
    });
    $('#addBtn').addEventListener('click', () => {
        const v = variantFor(sel.size, sel.color);
        if (!v) return;
        const inCart = cart.items.find(i => i.variant_id === v.id)?.qty || 0;
        if (inCart + sel.qty > v.stock) { toast(`المتاح من هذا الخيار ${v.stock} فقط`, true); return; }
        cart.add(v.id, p.id, sel.qty);
        toast('أُضيف إلى السلة');
    });
    $('.gallery-thumbs')?.addEventListener('click', e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        $('#galleryMain').innerHTML = `<img src="${esc(imgUrl(images[b.dataset.i].path))}" alt="${esc(p.name)}">`;
        $('.gallery-thumbs').querySelectorAll('button').forEach(o => o.classList.toggle('active', o === b));
    });
    refresh();
}

function cartSummaryHTML(lines, city) {
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const rate = city ? state.shipping.find(r => r.city === city) : null;
    const freeOver = Number(state.settings.free_shipping_over || 0);
    let fee = rate ? Number(rate.fee) : null;
    if (fee !== null && freeOver > 0 && subtotal >= freeOver) fee = 0;
    const total = subtotal + (fee || 0);
    return `
        <div class="summary-row"><span>المجموع</span><span class="price">${money(subtotal)}</span></div>
        <div class="summary-row"><span>الشحن</span><span>${fee === null ? '<span class="muted small">يُحدد حسب المدينة</span>' : fee === 0 ? '<span class="badge badge-ok">مجاني</span>' : money(fee)}</span></div>
        ${freeOver > 0 && subtotal < freeOver ? `<div class="small muted">أضيفي ${money(freeOver - subtotal)} للحصول على شحن مجاني</div>` : ''}
        <div class="summary-row total"><span>الإجمالي</span><span class="price">${money(total)}</span></div>
        <div class="small muted">شامل ضريبة القيمة المضافة ${esc(state.settings.vat_rate || 15)}٪</div>`;
}

function renderCart() {
    const lines = cart.lines();
    if (!lines.length) { app.innerHTML = `<div class="empty"><h2>سلتك فارغة</h2><a class="btn btn-primary" href="#/shop">ابدئي التسوق</a></div>`; return; }
    app.innerHTML = `
    <h1 style="margin-top:20px">السلة</h1>
    <div class="cart-layout">
        <div class="card" id="cartLines">
            ${lines.map(l => `<div class="cart-line" data-v="${esc(l.variant_id)}">
                <a class="cart-thumb" href="#/p/${esc(l.product.id)}">${productImage(l.product)}</a>
                <div>
                    <a class="name" href="#/p/${esc(l.product.id)}">${esc(l.product.name)}</a>
                    <div class="meta">${[l.variant.size ? 'المقاس: ' + esc(l.variant.size) : '', l.variant.color ? 'اللون: ' + esc(l.variant.color) : ''].filter(Boolean).join(' · ')}</div>
                    <div class="meta">${money(l.unit)} للقطعة ${l.qty > l.available ? `<span class="badge badge-danger">المتاح ${l.available}</span>` : ''}</div>
                    <div class="qty" style="margin-top:6px"><button type="button" data-act="minus" aria-label="أقل">−</button><span>${l.qty}</span><button type="button" data-act="plus" aria-label="أكثر">+</button></div>
                </div>
                <div>
                    <div class="line-total">${money(l.total)}</div>
                    <button type="button" class="remove" data-act="remove">حذف</button>
                </div>
            </div>`).join('')}
        </div>
        <div class="card summary">
            ${cartSummaryHTML(lines, null)}
            <a class="btn btn-primary btn-block" href="#/checkout">إتمام الطلب</a>
            <a class="btn btn-outline btn-block" href="#/shop" style="margin-top:8px">مواصلة التسوق</a>
        </div>
    </div>`;
    $('#cartLines').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const v = b.closest('[data-v]').dataset.v;
        const line = cart.lines().find(l => l.variant_id === v);
        if (b.dataset.act === 'remove') cart.remove(v);
        else if (b.dataset.act === 'plus') { if (line && line.qty >= line.available) { toast(`المتاح ${line.available} فقط`, true); return; } cart.setQty(v, (line?.qty || 1) + 1); }
        else if (b.dataset.act === 'minus') { if (line && line.qty <= 1) cart.remove(v); else cart.setQty(v, (line?.qty || 2) - 1); }
        renderCart();
    });
}

function renderCheckout() {
    const lines = cart.lines();
    if (!lines.length) { navigate('#/cart'); return; }
    const st = state.settings;
    const methods = [
        st.pay_gateway === '1' && st.moyasar_publishable_key ? { v: 'gateway', t: 'الدفع الإلكتروني', d: 'مدى، بطاقات ائتمانية، Apple Pay' } : null,
        st.pay_bank === '1' ? { v: 'bank_transfer', t: 'تحويل بنكي', d: 'تظهر بيانات الحساب بعد تأكيد الطلب، ويُرسل الإيصال عبر واتساب' } : null,
        st.pay_cod === '1' ? { v: 'cod', t: 'الدفع عند الاستلام', d: 'نقداً أو بالشبكة لمندوب التوصيل' } : null,
    ].filter(Boolean);
    const saved = (() => { try { return JSON.parse(localStorage.getItem('bellarosa_customer') || '{}'); } catch { return {}; } })();

    app.innerHTML = `
    <h1 style="margin-top:20px">إتمام الطلب</h1>
    <div class="cart-layout">
        <form class="card" id="checkoutForm" style="padding:18px" novalidate>
            <h3>بيانات التوصيل</h3>
            <div class="form-grid two">
                <div class="field"><label for="f_name">الاسم</label><input id="f_name" name="customer_name" required maxlength="80" value="${esc(saved.customer_name || '')}" autocomplete="name"></div>
                <div class="field"><label for="f_phone">رقم الجوال</label><input id="f_phone" name="customer_phone" required inputmode="tel" placeholder="05xxxxxxxx" value="${esc(saved.customer_phone || '')}" autocomplete="tel"><div class="hint">نتواصل معك عليه لتأكيد الطلب</div></div>
                <div class="field"><label for="f_city">المدينة</label><select id="f_city" name="city" required><option value="">اختاري المدينة</option>${state.shipping.map(r => `<option value="${esc(r.city)}" ${saved.city === r.city ? 'selected' : ''}>${esc(r.city)}</option>`).join('')}</select></div>
                <div class="field"><label for="f_district">الحي</label><input id="f_district" name="district" maxlength="80" value="${esc(saved.district || '')}"></div>
                <div class="field span"><label for="f_address">العنوان التفصيلي</label><input id="f_address" name="address" required maxlength="300" placeholder="الشارع، رقم المبنى، أقرب معلم" value="${esc(saved.address || '')}" autocomplete="street-address"></div>
                <div class="field span"><label for="f_notes">ملاحظات (اختياري)</label><textarea id="f_notes" name="notes" rows="2" maxlength="500"></textarea></div>
            </div>
            <h3 style="margin-top:22px">طريقة الدفع</h3>
            ${methods.length ? `<div class="radio-cards">${methods.map((m, i) => `<label class="radio-card"><input type="radio" name="payment_method" value="${m.v}" ${i === 0 ? 'checked' : ''}><span><span class="t">${m.t}</span><br><span class="d">${m.d}</span></span></label>`).join('')}</div>`
                : `<div class="form-error">لا توجد طريقة دفع مفعّلة حالياً — تواصلي معنا عبر واتساب.</div>`}
            <div class="form-error" id="formError" hidden></div>
            <button class="btn btn-primary btn-block" type="submit" id="submitBtn" style="margin-top:18px" ${methods.length ? '' : 'disabled'}>تأكيد الطلب</button>
            <p class="small muted" style="margin-top:10px">بتأكيد الطلب توافقين على ${esc(st.policy_returns ? 'سياسة الاستبدال والاسترجاع' : 'شروط المتجر')}.</p>
        </form>
        <div class="card summary">
            <h3>ملخص الطلب</h3>
            ${lines.map(l => `<div class="summary-row small"><span>${esc(l.product.name)} ${l.variant.size ? '(' + esc(l.variant.size) + ')' : ''} × ${l.qty}</span><span>${money(l.total)}</span></div>`).join('')}
            <div id="summaryBox">${cartSummaryHTML(lines, saved.city || null)}</div>
        </div>
    </div>`;

    $('#f_city').addEventListener('change', e => { $('#summaryBox').innerHTML = cartSummaryHTML(cart.lines(), e.target.value || null); });

    $('#checkoutForm').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const fd = Object.fromEntries(new FormData(form).entries());
        const err = $('#formError');
        err.hidden = true;
        form.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
        const problems = [];
        if (!fd.customer_name?.trim()) { problems.push('الاسم مطلوب'); $('#f_name').closest('.field').classList.add('invalid'); }
        if (!normalizePhone(fd.customer_phone)) { problems.push('رقم الجوال غير صحيح (05xxxxxxxx)'); $('#f_phone').closest('.field').classList.add('invalid'); }
        if (!fd.city) { problems.push('اختاري المدينة'); $('#f_city').closest('.field').classList.add('invalid'); }
        if (!fd.address?.trim()) { problems.push('العنوان مطلوب'); $('#f_address').closest('.field').classList.add('invalid'); }
        if (!fd.payment_method) problems.push('اختاري طريقة الدفع');
        if (problems.length) { err.textContent = problems.join(' · '); err.hidden = false; return; }

        const btn = $('#submitBtn');
        btn.disabled = true; btn.textContent = 'جارٍ إرسال الطلب…';
        const payload = {
            customer_name: fd.customer_name.trim(), customer_phone: normalizePhone(fd.customer_phone),
            city: fd.city, district: fd.district?.trim() || null, address: fd.address.trim(), notes: fd.notes?.trim() || null,
            payment_method: fd.payment_method,
            items: cart.lines().map(l => ({ variant_id: l.variant_id, qty: l.qty })),
        };
        const { data, error } = await sb.rpc('place_order', { p: payload });
        if (error) {
            err.textContent = friendlyError(error); err.hidden = false;
            btn.disabled = false; btn.textContent = 'تأكيد الطلب';
            // قد يكون المخزون تغيّر: نعيد تحميل الكتالوج
            loadCatalog().catch(() => {});
            return;
        }
        try { localStorage.setItem('bellarosa_customer', JSON.stringify({ customer_name: payload.customer_name, customer_phone: payload.customer_phone, city: payload.city, district: payload.district, address: payload.address })); } catch { }
        cart.clear();
        navigate(`#/order/${data.order_no}?t=${data.access_token}`);
    });
}
function friendlyError(error) {
    const m = error?.message || '';
    // رسائل place_order عربية أصلاً؛ ما عداها خطأ شبكة أو غير متوقع
    if (/[؀-ۿ]/.test(m)) return m;
    return 'تعذّر إرسال الطلب، حاولي مرة أخرى أو تواصلي معنا عبر واتساب.';
}

const STATUS_AR = { new: 'جديد', confirmed: 'مؤكد', preparing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغى' };
const PAY_AR = { unpaid: 'غير مدفوع', pending: 'بانتظار الدفع', paid: 'مدفوع', failed: 'فشل الدفع', refunded: 'مسترجع' };
const METHOD_AR = { gateway: 'دفع إلكتروني', bank_transfer: 'تحويل بنكي', cod: 'الدفع عند الاستلام' };
const EVENT_AR = e => e.event === 'created' ? 'تم استلام الطلب' : e.event === 'status' ? 'الحالة: ' + (STATUS_AR[e.details] || e.details) : e.event === 'payment' ? 'الدفع: ' + (PAY_AR[e.details] || e.details) : e.details;
function fmtDate(s) { return new Date(s).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }); }

async function renderOrder(orderNo, params) {
    const key = params.get('t') || params.get('k') || '';
    app.innerHTML = `<div class="loading">جارٍ تحميل الطلب…</div>`;
    const { data: o, error } = await sb.rpc('get_order', { p_order_no: orderNo, p_key: key });
    if (error || !o) { app.innerHTML = `<div class="empty">لم نجد هذا الطلب. تأكدي من رقم الطلب ورقم الجوال.<br><a class="btn btn-outline" href="#/track">تتبع الطلب</a></div>`; return; }
    const st = state.settings;

    // العودة من بوابة الدفع: نتحقق في السيرفر (لا نصدّق status القادم في الرابط) ثم نعيد قراءة الطلب
    const pid = params.get('pid');
    if (pid && o.payment_method === 'gateway' && o.payment_status !== 'paid' && o.access_token) {
        app.innerHTML = `<div class="loading">جارٍ التحقق من الدفع…</div>`;
        const { data: v, error: vErr } = await sb.functions.invoke('moyasar-verify', { body: { order_no: o.order_no, access_token: o.access_token, payment_id: pid } });
        const p2 = new URLSearchParams(params); p2.delete('pid'); p2.delete('pst');
        history.replaceState(null, '', `#/order/${encodeURIComponent(orderNo)}?${p2}`);
        if (vErr || !v?.ok) toast('تعذّر التحقق من الدفع الآن — إن خُصم المبلغ فسيُحدَّث الطلب تلقائياً خلال دقائق', true);
        else if (v.result === 'paid') toast('تم الدفع بنجاح، شكراً لك');
        else if (v.result === 'failed') toast('لم تكتمل عملية الدفع', true);
        else if (v.result === 'mismatch') toast('المبلغ المدفوع لا يطابق الطلب — سنتواصل معك', true);
        return renderOrder(orderNo, p2);
    }
    const steps = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];
    const idx = steps.indexOf(o.status);
    const justPlaced = params.has('t');

    let payBox = '';
    if (o.payment_status === 'paid') {
        payBox = `<div class="pay-box"><b>تم استلام الدفع</b> — شكراً لك.</div>`;
    } else if (o.payment_method === 'bank_transfer') {
        payBox = `<div class="pay-box">
            <h3>الدفع بالتحويل البنكي</h3>
            <p>حوّلي مبلغ <b>${money(o.total)}</b> إلى الحساب التالي، ثم أرسلي الإيصال مع رقم الطلب عبر واتساب ليُعتمد طلبك.</p>
            <div class="kv"><b>البنك</b><span>${esc(st.bank_name || '—')}</span></div>
            <div class="kv"><b>اسم الحساب</b><span>${esc(st.bank_account_name || '—')}</span></div>
            <div class="iban"><span id="ibanText">${esc(st.bank_iban || '—')}</span><button class="btn btn-outline btn-sm" type="button" id="copyIban">نسخ</button></div>
            ${st.store_whatsapp ? `<a class="btn btn-wa btn-block" style="margin-top:12px" target="_blank" rel="noopener" href="${esc(waLink(`مرحباً، هذا إيصال تحويل الطلب ${o.order_no} بمبلغ ${o.total} ر.س`))}">إرسال الإيصال عبر واتساب</a>` : ''}
        </div>`;
    } else if (o.payment_method === 'cod') {
        payBox = `<div class="pay-box"><h3>الدفع عند الاستلام</h3><p>سنتواصل معك على ${esc(o.customer_phone)} لتأكيد الطلب قبل الشحن. المبلغ المطلوب عند الاستلام: <b>${money(o.total)}</b>.</p></div>`;
    } else if (o.payment_method === 'gateway') {
        const enabled = st.pay_gateway === '1' && st.moyasar_publishable_key && o.access_token && o.status !== 'cancelled';
        payBox = `<div class="pay-box" id="gatewayBox">
            <h3>الدفع الإلكتروني</h3>
            ${o.payment_status === 'failed' ? '<div class="form-error">لم تكتمل عملية الدفع السابقة. يمكنك المحاولة مرة أخرى.</div>' : ''}
            ${enabled ? `<p>المبلغ المطلوب: <b>${money(o.total)}</b> — مدى، بطاقات ائتمانية، STC Pay.</p><div class="mysr-form" id="mysrForm"></div>`
                      : '<p class="muted">الدفع الإلكتروني غير متاح حالياً. تواصلي معنا عبر واتساب لإتمام الدفع.</p>'}
        </div>`;
    }

    app.innerHTML = `
    <div class="order-head">
        ${justPlaced ? `<h1>شكراً لك ${esc(o.customer_name)} 🌹</h1><p class="muted">تم استلام طلبك. احتفظي برقم الطلب ورابط هذه الصفحة.</p>` : `<h1>تفاصيل الطلب</h1>`}
        <div class="order-no">${esc(o.order_no)}</div>
        <p class="muted small">${fmtDate(o.created_at)}</p>
        <span class="badge ${o.status === 'cancelled' ? 'badge-danger' : o.status === 'delivered' ? 'badge-ok' : 'badge-warn'}">${STATUS_AR[o.status] || o.status}</span>
        <span class="badge ${o.payment_status === 'paid' ? 'badge-ok' : 'badge-muted'}">${PAY_AR[o.payment_status] || o.payment_status} · ${METHOD_AR[o.payment_method]}</span>
    </div>
    ${o.status !== 'cancelled' ? `<div class="steps">${steps.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''}"><i>${i + 1}</i>${STATUS_AR[s]}</div>`).join('')}</div>` : ''}
    <div class="info-grid">
        <div>
            ${payBox}
            <div class="card" style="padding:16px;margin-top:14px">
                <h3>الأصناف</h3>
                ${o.items.map(i => `<div class="cart-line"><div class="cart-thumb">${i.image ? `<img src="${esc(imgUrl(i.image))}" alt="">` : PLACEHOLDER}</div><div><div class="name">${esc(i.product_name)}</div><div class="meta">${[i.size ? 'المقاس: ' + esc(i.size) : '', i.color ? 'اللون: ' + esc(i.color) : ''].filter(Boolean).join(' · ')} · ${i.qty} × ${money(i.unit_price)}</div></div><div class="line-total">${money(i.line_total)}</div></div>`).join('')}
                <div class="summary-row"><span>المجموع</span><span>${money(o.subtotal)}</span></div>
                <div class="summary-row"><span>الشحن</span><span>${Number(o.shipping_fee) === 0 ? 'مجاني' : money(o.shipping_fee)}</span></div>
                ${Number(o.discount) > 0 ? `<div class="summary-row"><span>الخصم</span><span>− ${money(o.discount)}</span></div>` : ''}
                <div class="summary-row total"><span>الإجمالي</span><span class="price">${money(o.total)}</span></div>
                <div class="small muted">يشمل ضريبة القيمة المضافة: ${money(o.vat_amount)}</div>
            </div>
        </div>
        <div>
            <div class="card" style="padding:16px">
                <h3>التوصيل</h3>
                <div class="kv"><b>الاسم</b><span>${esc(o.customer_name)}</span></div>
                <div class="kv"><b>الجوال</b><span>${esc(o.customer_phone)}</span></div>
                <div class="kv"><b>المدينة</b><span>${esc(o.city)}${o.district ? ' — ' + esc(o.district) : ''}</span></div>
                <div class="kv"><b>العنوان</b><span>${esc(o.address)}</span></div>
                ${o.notes ? `<div class="kv"><b>ملاحظات</b><span>${esc(o.notes)}</span></div>` : ''}
            </div>
            <div class="card" style="padding:16px;margin-top:14px">
                <h3>سجل الطلب</h3>
                <ul class="timeline">${o.events.map(e => `<li>${esc(EVENT_AR(e))} <span class="muted small">— ${fmtDate(e.created_at)}</span></li>`).join('')}</ul>
            </div>
            ${st.store_whatsapp ? `<a class="btn btn-outline btn-block" style="margin-top:14px" target="_blank" rel="noopener" href="${esc(waLink(`مرحباً، استفسار عن الطلب ${o.order_no}`))}">استفسار عن الطلب عبر واتساب</a>` : ''}
        </div>
    </div>`;
    if ($('#mysrForm')) mountMoyasar(o);
    $('#copyIban')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText($('#ibanText').textContent.trim()); toast('تم نسخ الآيبان'); } catch { toast('تعذّر النسخ، انسخيه يدوياً', true); }
    });
}


// نموذج الدفع (Moyasar): يُحمَّل عند الحاجة فقط. المبلغ بالهللات، والعودة إلى صفحة الطلب نفسها (بلا hash
// لأن البوابة تضيف ?id= إلى الرابط) ثم boot() يعيد التوجيه إلى #/order/... ويُشغّل التحقق في السيرفر.
const MOYASAR_VER = '1.14.0';
function loadMoyasar() {
    if (window.Moyasar) return Promise.resolve();
    if (!document.getElementById('mysrCss')) {
        const l = document.createElement('link'); l.id = 'mysrCss'; l.rel = 'stylesheet';
        l.href = `https://cdn.moyasar.com/mpf/${MOYASAR_VER}/moyasar.css`; document.head.appendChild(l);
    }
    return new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = `https://cdn.moyasar.com/mpf/${MOYASAR_VER}/moyasar.js`;
        sc.onload = resolve; sc.onerror = () => reject(new Error('moyasar.js'));
        document.head.appendChild(sc);
    });
}
async function mountMoyasar(o) {
    try {
        await loadMoyasar();
        const cb = new URL(location.pathname, location.origin);
        cb.searchParams.set('pay', o.order_no); cb.searchParams.set('t', o.access_token);
        window.Moyasar.init({
            element: '#mysrForm',
            amount: Math.round(Number(o.total) * 100),
            currency: 'SAR',
            description: `${state.settings.store_name || 'بيلا روزا'} — طلب ${o.order_no}`,
            publishable_api_key: state.settings.moyasar_publishable_key,
            callback_url: cb.toString(),
            methods: ['creditcard', 'stcpay'],
            supported_networks: ['mada', 'visa', 'mastercard'],
            language: 'ar',
            fixed_width: false,
            metadata: { order_id: o.id || '', order_no: o.order_no },
            on_failure: () => toast('لم تكتمل عملية الدفع، حاولي مرة أخرى', true),
        });
    } catch (e) {
        console.error(e);
        const f = $('#mysrForm'); if (f) f.innerHTML = '<p class="muted">تعذّر تحميل نموذج الدفع. حدّثي الصفحة أو تواصلي معنا.</p>';
    }
}

function renderTrack() {
    app.innerHTML = `
    <div class="card" style="max-width:520px;margin:32px auto;padding:22px">
        <h1>تتبع الطلب</h1>
        <p class="muted">أدخلي رقم الطلب ورقم الجوال المستخدم في الطلب.</p>
        <form id="trackForm" class="form-grid" novalidate>
            <div class="field"><label for="t_no">رقم الطلب</label><input id="t_no" name="no" placeholder="BR-1001" required></div>
            <div class="field"><label for="t_phone">رقم الجوال</label><input id="t_phone" name="phone" inputmode="tel" placeholder="05xxxxxxxx" required></div>
            <button class="btn btn-primary" type="submit">عرض الطلب</button>
        </form>
    </div>`;
    $('#trackForm').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        let no = digits(fd.get('no')).trim().toUpperCase();
        if (/^\d+$/.test(no)) no = 'BR-' + no;
        const phone = normalizePhone(fd.get('phone'));
        if (!no || !phone) { toast('تأكدي من رقم الطلب ورقم الجوال', true); return; }
        navigate(`#/order/${encodeURIComponent(no)}?k=${phone}`);
    });
}

function renderPolicy() {
    app.innerHTML = `<div class="section"><h1>سياسة الاستبدال والاسترجاع</h1><div class="prose">${esc(state.settings.policy_returns || 'لم تُحدَّد السياسة بعد.')}</div></div>`;
}

// ---------- الموجّه ----------
function route() {
    if (!state.loaded) return;
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const params = new URLSearchParams(query);
    const parts = path.split('/').filter(Boolean);
    $('#nav').classList.remove('open');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + (parts[0] || '')));
    window.scrollTo({ top: 0 });
    try {
        if (!parts.length) renderHome();
        else if (parts[0] === 'shop') renderShop(params);
        else if (parts[0] === 'p' && parts[1]) renderProduct(parts[1]);
        else if (parts[0] === 'cart') renderCart();
        else if (parts[0] === 'checkout') renderCheckout();
        else if (parts[0] === 'order' && parts[1]) renderOrder(decodeURIComponent(parts[1]), params);
        else if (parts[0] === 'track') renderTrack();
        else if (parts[0] === 'policy') renderPolicy();
        else renderHome();
    } catch (e) {
        console.error(e);
        app.innerHTML = `<div class="empty">حدث خطأ غير متوقع. <a href="#/">العودة للرئيسية</a></div>`;
    }
}

async function boot() {
    const q = new URLSearchParams(location.search);
    if (q.get('pay')) {
        const p = new URLSearchParams();
        if (q.get('t')) p.set('t', q.get('t'));
        if (q.get('id')) p.set('pid', q.get('id'));
        if (q.get('status')) p.set('pst', q.get('status'));
        history.replaceState(null, '', location.pathname);
        location.hash = `#/order/${encodeURIComponent(q.get('pay'))}?${p}`;
    }
    cart.load();
    updateCartBadge();
    $('#menuBtn').addEventListener('click', () => $('#nav').classList.toggle('open'));
    window.addEventListener('hashchange', route);
    try {
        await loadCatalog();
        route();
    } catch (e) {
        console.error(e);
        app.innerHTML = `<div class="empty">تعذّر الاتصال بالمتجر حالياً. <button class="btn btn-outline" onclick="location.reload()">إعادة المحاولة</button></div>`;
    }
}
boot();
