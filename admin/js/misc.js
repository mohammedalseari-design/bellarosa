// اللوحة الرئيسية، التصنيفات، مدن الشحن، والإعدادات.

import { sb, app, $, $$, esc, money, fmtDate, toast, errMsg, badge, openModal, closeModal, confirmDialog, loadSettings, route, STATUS_AR, PAY_AR } from './app.js';
import { openOrder } from './orders.js';

// ---------- اللوحة ----------
export async function renderDashboard(content) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [{ count: todayCount }, { count: newCount }, { count: unpaidCount }, { data: paidMonth }, { data: lowStock }, { data: latest }] = await Promise.all([
        sb.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        sb.from('orders').select('id', { count: 'exact', head: true }).in('payment_status', ['unpaid', 'pending']).not('status', 'in', '(cancelled,delivered)'),
        sb.from('orders').select('total').eq('payment_status', 'paid').gte('paid_at', monthStart.toISOString()),
        sb.from('product_variants').select('id, size, color, stock, products(name)').lte('stock', 1).eq('is_active', true).limit(12),
        sb.from('orders').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    const monthTotal = (paidMonth || []).reduce((s, o) => s + Number(o.total), 0);

    content.innerHTML = `
    <div class="page-head"><h1>اللوحة</h1><span class="muted small">${fmtDate(new Date().toISOString())}</span></div>
    <div class="kpis">
        <div class="card kpi"><div class="v">${todayCount || 0}</div><div class="l">طلبات اليوم</div></div>
        <a class="card kpi" href="#/orders?status=new"><div class="v">${newCount || 0}</div><div class="l">بانتظار التأكيد</div></a>
        <a class="card kpi" href="#/orders?pay=unpaid"><div class="v">${unpaidCount || 0}</div><div class="l">غير مدفوعة</div></a>
        <div class="card kpi"><div class="v">${money(monthTotal)}</div><div class="l">مبيعات مدفوعة هذا الشهر</div></div>
        <a class="card kpi" href="#/products"><div class="v">${(lowStock || []).length}</div><div class="l">خيارات على وشك النفاد</div></a>
    </div>
    <div class="order-grid">
        <div class="card table-wrap">
            <h3 style="padding:14px 14px 0">آخر الطلبات</h3>
            ${(latest || []).length ? `<table><thead><tr><th>الطلب</th><th>الزبونة</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr></thead><tbody>
            ${latest.map(o => `<tr class="clickable" data-id="${esc(o.id)}"><td><b>${esc(o.order_no)}</b><br><span class="small muted">${fmtDate(o.created_at)}</span></td><td>${esc(o.customer_name)}<br><span class="small muted">${esc(o.city)}</span></td><td>${money(o.total)}</td><td>${badge(o.payment_status, PAY_AR)}</td><td>${badge(o.status, STATUS_AR)}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">لا توجد طلبات بعد</div>'}
        </div>
        <div class="card card-pad">
            <h3>مخزون منخفض (≤ 1)</h3>
            ${(lowStock || []).length ? lowStock.map(v => `<div class="kv"><span>${esc(v.products?.name || '')} <span class="small muted">${[v.size, v.color].filter(Boolean).join(' / ')}</span></span><b>${v.stock === 0 ? '<span class="badge b-cancelled">نافد</span>' : v.stock}</b></div>`).join('') : '<p class="muted small">لا يوجد</p>'}
        </div>
    </div>`;
    content.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => openOrder(tr.dataset.id)));
}

// ---------- قائمة بسيطة قابلة للتعديل (التصنيفات ومدن الشحن) ----------
async function simpleList(content, { title, table, columns, orderBy = 'sort_order', newLabel, hint }) {
    const { data, error } = await sb.from(table).select('*').order(orderBy);
    if (error) throw error;
    content.innerHTML = `
    <div class="page-head"><h1>${title}</h1><button class="btn btn-primary" id="addRow">+ ${newLabel}</button></div>
    ${hint ? `<p class="muted small">${hint}</p>` : ''}
    <div class="card table-wrap"><table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}<th>الحالة</th><th></th></tr></thead>
    <tbody>${data.map(r => `<tr data-id="${esc(r.id)}">${columns.map(c => `<td>${c.type === 'number' ? esc(r[c.key]) : esc(r[c.key] ?? '')}</td>`).join('')}<td>${r.is_active ? '<span class="badge b-on">فعّال</span>' : '<span class="badge b-off">معطّل</span>'}</td><td><button class="btn btn-outline btn-sm" data-edit>تعديل</button></td></tr>`).join('') || `<tr><td colspan="${columns.length + 2}" class="empty">لا يوجد</td></tr>`}</tbody></table></div>`;

    const openEditor = (row) => {
        const isNew = !row;
        row = row || Object.fromEntries(columns.map(c => [c.key, c.type === 'number' ? 0 : ''])); row.is_active ??= true;
        const body = openModal(isNew ? newLabel : 'تعديل', `
        <form id="rowForm">
            ${columns.map(c => `<div class="field"><label>${c.label}</label><input name="${c.key}" ${c.type === 'number' ? 'type="number" step="any"' : ''} value="${esc(row[c.key] ?? '')}" ${c.required ? 'required' : ''}></div>`).join('')}
            <label class="check"><input type="checkbox" name="is_active" ${row.is_active ? 'checked' : ''}> فعّال</label>
            <div class="alert" id="rowError" hidden></div>
            <div class="actions">${isNew ? '' : '<button type="button" class="btn btn-danger" id="rowDelete">حذف</button>'}<button type="button" class="btn btn-outline" id="rowCancel">إلغاء</button><button type="submit" class="btn btn-primary">حفظ</button></div>
        </form>`, { narrow: true });
        $('#rowCancel', body).onclick = closeModal;
        $('#rowDelete', body)?.addEventListener('click', async () => {
            if (!await confirmDialog('حذف هذا السجل؟')) return;
            const { error } = await sb.from(table).delete().eq('id', row.id);
            if (error) { toast(errMsg(error), true); return; }
            toast('تم الحذف'); closeModal(); route();
        });
        $('#rowForm', body).addEventListener('submit', async e => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const rec = { is_active: fd.get('is_active') === 'on' };
            for (const c of columns) rec[c.key] = c.type === 'number' ? Number(fd.get(c.key) || 0) : (fd.get(c.key) || '').trim() || (c.required ? '' : null);
            const { error } = isNew ? await sb.from(table).insert(rec) : await sb.from(table).update(rec).eq('id', row.id);
            if (error) { const el = $('#rowError', body); el.textContent = errMsg(error); el.hidden = false; return; }
            toast('تم الحفظ'); closeModal(); route();
        });
    };
    $('#addRow').addEventListener('click', () => openEditor(null));
    content.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEditor(data.find(r => r.id === b.closest('tr').dataset.id))));
}

export function renderCategories(content) {
    return simpleList(content, {
        title: 'التصنيفات', table: 'categories', newLabel: 'تصنيف جديد',
        columns: [{ key: 'name', label: 'الاسم', required: true }, { key: 'slug', label: 'المعرّف في الرابط (لاتيني)' }, { key: 'sort_order', label: 'الترتيب', type: 'number' }],
        hint: 'التصنيف المعطّل يُخفى من المتجر مع بقاء منتجاته ظاهرة في "الكل".',
    });
}
export function renderShipping(content) {
    return simpleList(content, {
        title: 'مدن الشحن ورسومه', table: 'shipping_rates', newLabel: 'مدينة جديدة',
        columns: [{ key: 'city', label: 'المدينة', required: true }, { key: 'fee', label: 'رسوم الشحن (ر.س)', type: 'number' }, { key: 'sort_order', label: 'الترتيب', type: 'number' }],
        hint: 'الزبونة تختار مدينتها من هذه القائمة فقط؛ المدينة غير المدرجة لا يُقبل الطلب إليها. الشحن المجاني فوق مبلغ معيّن يُضبط من الإعدادات.',
    });
}

// ---------- الإعدادات (للمدير) ----------
const SETTINGS_GROUPS = [
    { title: 'المتجر', keys: [
        ['store_name', 'اسم المتجر'], ['store_tagline', 'الوصف المختصر'], ['announcement', 'شريط الإعلان أعلى المتجر (فارغ = مخفي)'],
        ['store_phone', 'رقم الهاتف'], ['store_whatsapp', 'رقم واتساب (بصيغة 9665xxxxxxxx)'], ['store_instagram', 'حساب إنستقرام'],
    ] },
    { title: 'طرق الدفع', keys: [
        ['pay_cod', 'الدفع عند الاستلام (1 = مفعّل، 0 = معطّل)'], ['pay_bank', 'التحويل البنكي (1/0)'], ['pay_gateway', 'الدفع الإلكتروني (1/0) — يحتاج ربط بوابة الدفع (المرحلة 2)'],
        ['bank_name', 'اسم البنك'], ['bank_account_name', 'اسم صاحب الحساب'], ['bank_iban', 'الآيبان'], ['moyasar_publishable_key', 'مفتاح النشر لبوابة الدفع (pk_...)'],
    ] },
    { title: 'الضريبة والشحن', keys: [
        ['vat_enabled', 'احتساب ضريبة القيمة المضافة (1/0)'], ['vat_rate', 'نسبة الضريبة ٪'], ['vat_number', 'الرقم الضريبي (يظهر في الفاتورة)'],
        ['free_shipping_over', 'شحن مجاني للطلبات فوق (ر.س) — فارغ = لا يوجد'], ['currency', 'رمز العملة'],
    ] },
    { title: 'السياسات', keys: [['policy_returns', 'سياسة الاستبدال والاسترجاع']] },
];

export async function renderSettings(content) {
    await loadSettings();
    const s = app.settings;
    content.innerHTML = `
    <div class="page-head"><h1>الإعدادات</h1></div>
    <form id="settingsForm">
        ${SETTINGS_GROUPS.map(g => `<div class="card card-pad" style="margin-bottom:14px"><h3>${g.title}</h3><div class="form-grid two">
            ${g.keys.map(([k, label]) => k === 'policy_returns'
                ? `<div class="field span"><label>${label}</label><textarea name="${k}" rows="4">${esc(s[k] ?? '')}</textarea></div>`
                : `<div class="field"><label>${label}</label><input name="${k}" value="${esc(s[k] ?? '')}" ${k === 'bank_iban' || k === 'moyasar_publishable_key' ? 'dir="ltr"' : ''}></div>`).join('')}
        </div></div>`).join('')}
        <div class="alert alert-info">المفتاح السري لبوابة الدفع لا يُحفظ هنا أبداً؛ مكانه أسرار Edge Function في Supabase (انظري docs/TASK_PHASE2_PAYMENT.md).</div>
        <div class="actions"><button class="btn btn-primary" type="submit">حفظ الإعدادات</button></div>
    </form>`;
    $('#settingsForm').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const rows = [];
        for (const g of SETTINGS_GROUPS) for (const [k] of g.keys) {
            const existing = (app.settingsRows || []).find(r => r.key === k);
            rows.push({ key: k, value: String(fd.get(k) ?? '').trim(), is_public: existing ? existing.is_public : true });
        }
        const { error } = await sb.from('settings').upsert(rows, { onConflict: 'key' });
        if (error) { toast(errMsg(error), true); return; }
        toast('حُفظت الإعدادات');
        await loadSettings();
    });
}
