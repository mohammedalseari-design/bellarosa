// الطلبات: قائمة بفلاتر، تفاصيل، تغيير الحالة والدفع، ملاحظات، وطباعة فاتورة مبسطة.
// المبالغ لا تُعدَّل هنا (الحارس في قاعدة البيانات يرفض)، والإلغاء يرجع المخزون تلقائياً.

import { sb, app, $, $$, esc, money, fmtDate, toast, errMsg, badge, openModal, closeModal, confirmDialog, refreshNewOrdersPill, route, STATUS_AR, PAY_AR, METHOD_AR } from './app.js';

const PAGE = 50;

export async function renderOrders(content, params) {
    const status = params.get('status') || '';
    const q = params.get('q') || '';
    const pay = params.get('pay') || '';
    let query = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(PAGE);
    if (status) query = query.eq('status', status);
    if (pay) query = query.eq('payment_status', pay);
    if (q) {
        const digits = q.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
        query = query.or(`order_no.ilike.%${digits.replace(/[%,]/g, '')}%,customer_phone.ilike.%${digits.replace(/[%,]/g, '')}%,customer_name.ilike.%${q.replace(/[%,]/g, '')}%`);
    }
    const { data: orders, error } = await query;
    if (error) throw error;

    content.innerHTML = `
    <div class="page-head"><h1>الطلبات</h1><span class="muted small">آخر ${PAGE} طلب مطابق</span></div>
    <form class="toolbar" id="ordersFilter">
        <input name="q" value="${esc(q)}" placeholder="بحث برقم الطلب / الجوال / الاسم">
        <select name="status"><option value="">كل الحالات</option>${Object.entries(STATUS_AR).map(([k, v]) => `<option value="${k}" ${status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select name="pay"><option value="">كل حالات الدفع</option>${Object.entries(PAY_AR).map(([k, v]) => `<option value="${k}" ${pay === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn btn-outline" type="submit">تصفية</button>
    </form>
    <div class="card table-wrap">
        ${orders.length ? `<table><thead><tr><th>الطلب</th><th>التاريخ</th><th>الزبونة</th><th>المدينة</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr></thead>
        <tbody>${orders.map(o => `<tr class="clickable" data-id="${esc(o.id)}">
            <td><b>${esc(o.order_no)}</b></td><td class="small">${fmtDate(o.created_at)}</td>
            <td>${esc(o.customer_name)}<br><span class="small muted">${esc(o.customer_phone)}</span></td>
            <td>${esc(o.city)}</td><td>${money(o.total)}</td>
            <td>${badge(o.payment_status, PAY_AR)}<br><span class="small muted">${esc(METHOD_AR[o.payment_method])}</span></td>
            <td>${badge(o.status, STATUS_AR)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">لا توجد طلبات مطابقة</div>'}
    </div>`;

    $('#ordersFilter').addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const p = new URLSearchParams();
        for (const k of ['q', 'status', 'pay']) if (fd.get(k)) p.set(k, fd.get(k));
        location.hash = '#/orders' + (p.toString() ? '?' + p : '');
    });
    $$('#ordersFilter select').forEach(s => s.addEventListener('change', () => $('#ordersFilter').requestSubmit()));
    content.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => openOrder(tr.dataset.id)));
}

export async function openOrder(id) {
    const [{ data: o, error }, { data: items }, { data: events }] = await Promise.all([
        sb.from('orders').select('*').eq('id', id).single(),
        sb.from('order_items').select('*').eq('order_id', id).order('product_name'),
        sb.from('order_events').select('*').eq('order_id', id).order('created_at'),
    ]);
    if (error) { toast(errMsg(error), true); return; }
    const st = app.settings;
    const wa = (o.customer_phone.replace(/^0/, '966'));
    const canCancel = !['cancelled', 'delivered'].includes(o.status);

    const body = openModal(`الطلب ${o.order_no}`, `
    <div class="order-grid">
        <div>
            <div class="card card-pad">
                <h3>الأصناف</h3>
                ${items.map(i => `<div class="line"><div class="grow">${esc(i.product_name)}<br><span class="small muted">${[i.size ? 'المقاس ' + esc(i.size) : '', i.color ? 'اللون ' + esc(i.color) : ''].filter(Boolean).join(' · ')}</span></div><div>${i.qty} × ${money(i.unit_price)}</div><div><b>${money(i.line_total)}</b></div></div>`).join('')}
                <div class="kv"><b>المجموع</b><span>${money(o.subtotal)}</span></div>
                <div class="kv"><b>الشحن</b><span>${money(o.shipping_fee)}</span></div>
                ${Number(o.discount) > 0 ? `<div class="kv"><b>الخصم</b><span>− ${money(o.discount)}</span></div>` : ''}
                <div class="kv"><b>الإجمالي</b><span><b>${money(o.total)}</b></span></div>
                <div class="kv"><b>منها ضريبة</b><span>${money(o.vat_amount)}</span></div>
            </div>
            <div class="card card-pad" style="margin-top:12px">
                <h3>الزبونة والتوصيل</h3>
                <div class="kv"><b>الاسم</b><span>${esc(o.customer_name)}</span></div>
                <div class="kv"><b>الجوال</b><span><a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a> · <a href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(`مرحباً ${o.customer_name}، بخصوص طلبك ${o.order_no} من ${st.store_name || 'بيلا روزا'}`)}" target="_blank" rel="noopener">واتساب</a></span></div>
                ${o.customer_email ? `<div class="kv"><b>البريد</b><span>${esc(o.customer_email)}</span></div>` : ''}
                <div class="kv"><b>المدينة</b><span>${esc(o.city)}${o.district ? ' — ' + esc(o.district) : ''}</span></div>
                <div class="kv"><b>العنوان</b><span>${esc(o.address)}</span></div>
                ${o.notes ? `<div class="kv"><b>ملاحظات الزبونة</b><span>${esc(o.notes)}</span></div>` : ''}
                <div class="kv"><b>طريقة الدفع</b><span>${esc(METHOD_AR[o.payment_method])}${o.gateway_payment_id ? ` <span class="small muted">(${esc(o.gateway_payment_id)})</span>` : ''}</span></div>
            </div>
        </div>
        <div>
            <div class="card card-pad">
                <h3>الإجراءات</h3>
                <div class="field"><label>حالة الطلب</label>
                    <select id="oStatus" ${o.status === 'cancelled' ? 'disabled' : ''}>${Object.entries(STATUS_AR).filter(([k]) => k !== 'cancelled').map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
                <div class="field"><label>حالة الدفع</label>
                    <select id="oPay">${Object.entries(PAY_AR).map(([k, v]) => `<option value="${k}" ${o.payment_status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
                    ${o.paid_at ? `<div class="hint">تاريخ الدفع: ${fmtDate(o.paid_at)}</div>` : ''}</div>
                <button class="btn btn-primary btn-block" id="oSave" ${o.status === 'cancelled' ? 'disabled' : ''}>حفظ التغييرات</button>
                <div class="actions">
                    <button class="btn btn-outline btn-sm" id="oPrint">طباعة فاتورة</button>
                    ${canCancel ? `<button class="btn btn-danger btn-sm" id="oCancel">إلغاء الطلب</button>` : ''}
                </div>
                ${o.status === 'cancelled' ? '<div class="alert" style="margin-top:12px">طلب ملغى — أُرجع مخزونه، ولا يمكن إعادة فتحه.</div>' : ''}
            </div>
            <div class="card card-pad" style="margin-top:12px">
                <h3>السجل</h3>
                <ul class="timeline">${events.map(e => `<li>${esc(eventText(e))} <span class="small muted">— ${esc(e.actor_name || '')} · ${fmtDate(e.created_at)}</span></li>`).join('')}</ul>
                <form id="noteForm" style="margin-top:10px;display:flex;gap:6px"><input name="note" placeholder="ملاحظة داخلية…" required style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:8px"><button class="btn btn-outline btn-sm" type="submit">إضافة</button></form>
            </div>
        </div>
    </div>
    <div class="invoice" id="invoice">${invoiceHTML(o, items)}</div>`);

    $('#oSave', body).addEventListener('click', async () => {
        const patch = { status: $('#oStatus', body).value, payment_status: $('#oPay', body).value };
        const { error } = await sb.from('orders').update(patch).eq('id', id);
        if (error) { toast(errMsg(error), true); return; }
        toast('تم الحفظ');
        refreshNewOrdersPill();
        closeModal();
        route();
    });
    $('#oCancel', body)?.addEventListener('click', async () => {
        if (!await confirmDialog(`إلغاء الطلب ${o.order_no}؟ سيُرجَع المخزون ولا يمكن التراجع.`)) return;
        const { error } = await sb.from('orders').update({ status: 'cancelled' }).eq('id', id);
        if (error) { toast(errMsg(error), true); return; }
        toast('أُلغي الطلب وأُرجع المخزون');
        refreshNewOrdersPill();
        closeModal();
        route();
    });
    $('#oPrint', body).addEventListener('click', () => window.print());
    $('#noteForm', body).addEventListener('submit', async e => {
        e.preventDefault();
        const note = new FormData(e.target).get('note').trim();
        if (!note) return;
        const { error } = await sb.from('order_events').insert({ order_id: id, event: 'note', details: note, actor_name: app.profile.fullname || app.profile.username });
        if (error) { toast(errMsg(error), true); return; }
        openOrder(id);
    });
}
function eventText(e) {
    if (e.event === 'created') return 'تم استلام الطلب — ' + (e.details || '');
    if (e.event === 'status') return 'الحالة: ' + (STATUS_AR[e.details] || e.details);
    if (e.event === 'payment') return 'الدفع: ' + (PAY_AR[e.details] || e.details);
    if (e.event === 'note') return 'ملاحظة: ' + (e.details || '');
    return e.details || e.event;
}

function invoiceHTML(o, items) {
    const st = app.settings;
    return `
    <h2 style="margin:0">${esc(st.store_name || 'بيلا روزا')}</h2>
    <div>${st.vat_number ? 'الرقم الضريبي: ' + esc(st.vat_number) : ''} ${st.store_phone ? ' · هاتف: ' + esc(st.store_phone) : ''}</div>
    <h3>فاتورة ضريبية مبسطة — الطلب ${esc(o.order_no)}</h3>
    <div>التاريخ: ${fmtDate(o.created_at)} · الزبونة: ${esc(o.customer_name)} · ${esc(o.customer_phone)}</div>
    <div>العنوان: ${esc(o.city)} ${esc(o.district || '')} ${esc(o.address)}</div>
    <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${items.map(i => `<tr><td>${esc(i.product_name)} ${i.size ? '(' + esc(i.size) + ')' : ''} ${esc(i.color || '')}</td><td>${i.qty}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`).join('')}</tbody></table>
    <div>المجموع: ${money(o.subtotal)} · الشحن: ${money(o.shipping_fee)} ${Number(o.discount) > 0 ? '· الخصم: ' + money(o.discount) : ''}</div>
    <div><b>الإجمالي شامل الضريبة: ${money(o.total)}</b> (ضريبة القيمة المضافة ${esc(st.vat_rate || 15)}٪: ${money(o.vat_amount)})</div>
    <div>طريقة الدفع: ${esc(METHOD_AR[o.payment_method])} — ${esc(PAY_AR[o.payment_status])}</div>`;
}
