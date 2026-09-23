// بيلا روزا — لوحة الإدارة: الجلسة، التنقل، والأدوات المشتركة.
// الدخول باسم مستخدم يُحوَّل إلى إيميل داخلي (username@users.bellarosa.sa)، والصلاحيات في قاعدة البيانات (RLS).

import { renderDashboard, renderCategories, renderShipping, renderSettings } from './misc.js';
import { renderOrders } from './orders.js';
import { renderProducts } from './products.js';

export const CFG = window.BELLAROSA_CONFIG;
export const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
export const app = { profile: null, settings: {} };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function money(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ر.س'; }
export function fmtDate(s) { return s ? new Date(s).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
export function imgUrl(path) { return `${CFG.SUPABASE_URL}/storage/v1/object/public/product-images/${path}`; }
export function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = 'toast', 3000);
}
export function errMsg(error) {
    const m = error?.message || String(error);
    if (/[؀-ۿ]/.test(m)) return m;
    if (/row-level security/i.test(m)) return 'ليس لديك صلاحية لهذا الإجراء';
    if (/duplicate key/i.test(m)) return 'القيمة مكررة (موجودة مسبقاً)';
    return 'حدث خطأ: ' + m;
}
export const STATUS_AR = { new: 'جديد', confirmed: 'مؤكد', preparing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغى' };
export const PAY_AR = { unpaid: 'غير مدفوع', pending: 'بانتظار الدفع', paid: 'مدفوع', failed: 'فشل الدفع', refunded: 'مسترجع' };
export const METHOD_AR = { gateway: 'دفع إلكتروني', bank_transfer: 'تحويل بنكي', cod: 'عند الاستلام' };
export const badge = (v, map) => `<span class="badge b-${esc(v)}">${esc(map[v] || v)}</span>`;

// نافذة عامة
export function openModal(title, html, { narrow = false } = {}) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal .modal').classList.toggle('narrow', narrow);
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
    return $('#modalBody');
}
export function closeModal() {
    $('#modal').hidden = true;
    $('#modalBody').innerHTML = '';
    document.body.style.overflow = '';
}
// نافذة تأكيد مستقلة فوق أي نافذة مفتوحة (لا تستبدل محتواها)
export function confirmDialog(text) {
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.className = 'modal-backdrop';
        wrap.style.zIndex = '70';
        wrap.innerHTML = `<div class="modal narrow" role="dialog" aria-modal="true"><div class="modal-head"><h2>تأكيد</h2></div><div class="modal-body"><p>${esc(text)}</p><div class="actions"><button class="btn btn-outline" id="cNo">إلغاء</button><button class="btn btn-danger" id="cYes">تأكيد</button></div></div></div>`;
        document.body.appendChild(wrap);
        const done = v => { wrap.remove(); resolve(v); };
        $('#cNo', wrap).onclick = () => done(false);
        $('#cYes', wrap).onclick = () => done(true);
        wrap.addEventListener('click', e => { if (e.target === wrap) done(false); });
    });
}

export async function loadSettings() {
    const { data, error } = await sb.from('settings').select('key,value,is_public');
    if (error) throw error;
    app.settings = Object.fromEntries(data.map(r => [r.key, r.value]));
    app.settingsRows = data;
}

// ---------- الجلسة ----------
async function loadProfile() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return data && !data.is_blocked ? data : null;
}
function showLogin(msg) {
    $('#bootScreen').hidden = true;
    $('#appShell').hidden = true;
    $('#pwScreen').hidden = true;
    $('#loginScreen').hidden = false;
    const e = $('#loginError');
    e.hidden = !msg; e.textContent = msg || '';
}

// ---------- كلمة المرور ----------
// تُرجع رسالة عربية إن كانت المدخلات غير صالحة، وإلا فارغة
function passwordProblem(p1, p2) {
    if (p1.length < 8) return 'كلمة المرور يجب أن تكون 8 خانات فأكثر';
    if (p1 !== p2) return 'كلمتا المرور غير متطابقتين';
    return '';
}
function passwordErr(error) {
    const m = error?.message || '';
    if (/different from the old/i.test(m)) return 'كلمة المرور الجديدة يجب أن تختلف عن الحالية';
    if (/at least \d+ characters/i.test(m)) return 'كلمة المرور قصيرة جداً';
    if (/weak|pwned|easy to guess/i.test(m)) return 'كلمة المرور ضعيفة أو شائعة؛ اختاري كلمة أقوى';
    return errMsg(error);
}
// تغيير كلمة مرور الحساب الحالي في Supabase ثم رفع علم الإلزام عن الملف
export async function changePassword(p1, p2) {
    const problem = passwordProblem(p1, p2);
    if (problem) throw new Error(problem);
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) throw new Error(passwordErr(error));
    const { error: e2 } = await sb.rpc('password_changed');
    if (e2) throw new Error(errMsg(e2));
    if (app.profile) app.profile.must_change_password = false;
}
// شاشة إجبارية: لا تُفتح اللوحة قبل تعيين كلمة مرور خاصة (بعد الدخول بكلمة المرور المؤقتة)
function showPasswordScreen(profile) {
    app.profile = profile;
    $('#bootScreen').hidden = true;
    $('#loginScreen').hidden = true;
    $('#appShell').hidden = true;
    $('#pwScreen').hidden = false;
    $('#pwError').hidden = true;
    $('#pw1').value = ''; $('#pw2').value = '';
    $('#pw1').focus();
}
$('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#pwBtn'), err = $('#pwError');
    btn.disabled = true; err.hidden = true;
    try {
        await changePassword($('#pw1').value, $('#pw2').value);
        $('#pw1').value = ''; $('#pw2').value = '';
        await showApp(app.profile);
        toast('تم حفظ كلمة المرور الجديدة');
    } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
    } finally { btn.disabled = false; }
});
$('#pwLogout').addEventListener('click', async () => { await sb.auth.signOut(); location.hash = ''; showLogin(); });
// تغيير اختياري من شريط اللوحة (لأي موظف)
$('#changePwBtn').addEventListener('click', () => {
    const body = openModal('تغيير كلمة المرور', `
        <form id="pwModalForm" autocomplete="off">
            <div class="alert" id="pwModalError" hidden></div>
            <div class="field"><label for="mpw1">كلمة المرور الجديدة</label><input id="mpw1" type="password" required minlength="8" autocomplete="new-password"></div>
            <div class="field"><label for="mpw2">تأكيد كلمة المرور</label><input id="mpw2" type="password" required minlength="8" autocomplete="new-password"></div>
            <div class="actions"><button class="btn btn-outline" type="button" id="mpwCancel">إلغاء</button><button class="btn btn-primary" type="submit" id="mpwSave">حفظ</button></div>
        </form>`, { narrow: true });
    $('#mpwCancel', body).onclick = closeModal;
    $('#pwModalForm', body).addEventListener('submit', async e => {
        e.preventDefault();
        const btn = $('#mpwSave', body), err = $('#pwModalError', body);
        btn.disabled = true; err.hidden = true;
        try {
            await changePassword($('#mpw1', body).value, $('#mpw2', body).value);
            closeModal();
            toast('تم تغيير كلمة المرور');
        } catch (ex) {
            err.textContent = ex.message; err.hidden = false; btn.disabled = false;
        }
    });
});

async function showApp(profile) {
    if (profile.must_change_password) { showPasswordScreen(profile); return; }
    app.profile = profile;
    $('#bootScreen').hidden = true;
    $('#loginScreen').hidden = true;
    $('#pwScreen').hidden = true;
    $('#appShell').hidden = false;
    $('#userBadge').textContent = (profile.fullname || profile.username) + (profile.role === 'admin' ? ' · مدير' : '');
    $$('[data-admin]').forEach(a => a.hidden = profile.role !== 'admin');
    try { await loadSettings(); } catch (e) { toast(errMsg(e), true); }
    route();
    refreshNewOrdersPill();
}
export async function refreshNewOrdersPill() {
    const { count } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new');
    const pill = $('#newOrdersPill');
    pill.textContent = count || 0;
    pill.hidden = !count;
}

$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginBtn');
    btn.disabled = true;
    const u = $('#username').value.trim();
    const email = u.includes('@') ? u : `${u}@${CFG.AUTH_EMAIL_DOMAIN}`;
    const { error } = await sb.auth.signInWithPassword({ email, password: $('#password').value });
    btn.disabled = false;
    if (error) { showLogin('اسم المستخدم أو كلمة المرور غير صحيحة'); return; }
    const profile = await loadProfile();
    if (!profile) { await sb.auth.signOut(); showLogin('هذا الحساب غير مصرح له بالدخول'); return; }
    $('#password').value = '';
    showApp(profile);
});
$('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.hash = ''; showLogin(); });
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

// ---------- التنقل ----------
const pages = { dashboard: renderDashboard, orders: renderOrders, products: renderProducts, categories: renderCategories, shipping: renderShipping, settings: renderSettings };
export function route() {
    if (!app.profile) return;
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const page = pages[path] ? path : 'dashboard';
    if (page === 'settings' && app.profile.role !== 'admin') { location.hash = '#/'; return; }
    $$('#sideNav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    const content = $('#content');
    content.innerHTML = '<div class="empty">جارٍ التحميل…</div>';
    pages[page](content, new URLSearchParams(query)).catch(e => {
        console.error(e);
        content.innerHTML = `<div class="alert">${esc(errMsg(e))}</div>`;
    });
}
window.addEventListener('hashchange', route);

(async function boot() {
    const profile = await loadProfile();
    if (profile) showApp(profile); else showLogin();
    sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showLogin(); });
})();
