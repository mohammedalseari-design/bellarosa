// المنتجات: قائمة، إضافة/تعديل، المقاسات والألوان بمخزونها، والصور (تُصغَّر في المتصفح قبل الرفع إلى Supabase Storage).

import { sb, $, $$, esc, money, imgUrl, toast, errMsg, openModal, closeModal, confirmDialog, route } from './app.js';

let categories = [];

export async function renderProducts(content, params) {
    const q = (params.get('q') || '').trim();
    const [{ data: cats }, { data: products, error }] = await Promise.all([
        sb.from('categories').select('*').order('sort_order'),
        sb.from('products').select('*, product_variants(*), product_images(*)').order('sort_order').order('created_at', { ascending: false }),
    ]);
    if (error) throw error;
    categories = cats || [];
    const list = q ? products.filter(p => p.name.includes(q)) : products;

    content.innerHTML = `
    <div class="page-head"><h1>المنتجات <span class="muted small">(${products.length})</span></h1><button class="btn btn-primary" id="newProduct">+ منتج جديد</button></div>
    <form class="toolbar" id="prodSearch"><input name="q" value="${esc(q)}" placeholder="بحث باسم المنتج"><button class="btn btn-outline" type="submit">بحث</button></form>
    <div class="card table-wrap">
        ${list.length ? `<table><thead><tr><th></th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>الحالة</th></tr></thead>
        <tbody>${list.map(p => {
            const img = (p.product_images || []).sort((a, b) => a.sort_order - b.sort_order)[0];
            const stock = (p.product_variants || []).reduce((s, v) => s + v.stock, 0);
            const cat = categories.find(c => c.id === p.category_id);
            return `<tr class="clickable" data-id="${esc(p.id)}">
                <td>${img ? `<img class="thumb" src="${esc(imgUrl(img.path))}" alt="">` : '<div class="thumb-ph"></div>'}</td>
                <td><b>${esc(p.name)}</b>${p.is_featured ? ' <span class="badge b-on">مميز</span>' : ''}<br><span class="small muted">${(p.product_variants || []).length} خيار</span></td>
                <td>${esc(cat ? cat.name : '—')}</td>
                <td>${money(p.price)}${p.compare_at_price ? `<br><span class="small muted" style="text-decoration:line-through">${money(p.compare_at_price)}</span>` : ''}</td>
                <td>${stock === 0 ? '<span class="badge b-cancelled">نافد</span>' : stock <= 3 ? `<span class="badge b-confirmed">${stock}</span>` : stock}</td>
                <td>${p.is_active ? '<span class="badge b-on">ظاهر</span>' : '<span class="badge b-off">مخفي</span>'}</td></tr>`;
        }).join('')}</tbody></table>` : '<div class="empty">لا توجد منتجات بعد. أضيفي أول منتج.</div>'}
    </div>`;

    $('#newProduct').addEventListener('click', () => openProductEditor(null));
    $('#prodSearch').addEventListener('submit', e => { e.preventDefault(); const v = new FormData(e.target).get('q'); location.hash = '#/products' + (v ? '?q=' + encodeURIComponent(v) : ''); });
    content.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => openProductEditor(products.find(p => p.id === tr.dataset.id))));
}

function variantRow(v = {}) {
    return `<tr data-vid="${esc(v.id || '')}">
        <td><input name="size" value="${esc(v.size || '')}" placeholder="4-5 سنوات"></td>
        <td><input name="color" value="${esc(v.color || '')}" placeholder="اختياري"></td>
        <td><input name="stock" type="number" min="0" value="${v.stock ?? 0}"></td>
        <td><input name="price_override" type="number" min="0" step="0.01" value="${v.price_override ?? ''}" placeholder="نفس السعر"></td>
        <td><input name="sku" value="${esc(v.sku || '')}" placeholder="اختياري"></td>
        <td><input name="is_active" type="checkbox" ${v.is_active === false ? '' : 'checked'} title="ظاهر"></td>
        <td><button type="button" class="icon-btn" data-del title="حذف">🗑</button></td>
    </tr>`;
}

async function openProductEditor(p) {
    const isNew = !p;
    p = p || { name: '', description: '', price: '', compare_at_price: '', category_id: '', is_active: true, is_featured: false, sort_order: 0, product_variants: [], product_images: [] };
    const images = (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order).map(i => ({ ...i }));
    const removedImages = [];
    const pendingFiles = []; // ملفات جديدة تُرفع عند الحفظ

    const body = openModal(isNew ? 'منتج جديد' : 'تعديل المنتج', `
    <form id="productForm">
        <div class="form-grid two">
            <div class="field span"><label>اسم المنتج</label><input name="name" required maxlength="120" value="${esc(p.name)}"></div>
            <div class="field"><label>التصنيف</label><select name="category_id"><option value="">بدون</option>${categories.map(c => `<option value="${esc(c.id)}" ${p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label>ترتيب العرض</label><input name="sort_order" type="number" value="${p.sort_order ?? 0}"><div class="hint">الأصغر يظهر أولاً</div></div>
            <div class="field"><label>السعر (شامل الضريبة)</label><input name="price" type="number" min="0" step="0.01" required value="${esc(p.price)}"></div>
            <div class="field"><label>السعر قبل الخصم (اختياري)</label><input name="compare_at_price" type="number" min="0" step="0.01" value="${esc(p.compare_at_price ?? '')}"><div class="hint">يظهر مشطوباً بجانب السعر</div></div>
            <div class="field span"><label>الوصف</label><textarea name="description" rows="4">${esc(p.description || '')}</textarea></div>
        </div>
        <label class="check"><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''}> ظاهر في المتجر</label>
        <label class="check"><input type="checkbox" name="is_featured" ${p.is_featured ? 'checked' : ''}> ضمن مختارات الصفحة الرئيسية</label>

        <h3 style="margin-top:18px">المقاسات والألوان</h3>
        <p class="small muted">كل سطر خيار مستقل بمخزونه (المقاس = العمر عادةً). اتركي المقاس أو اللون فارغاً إن لم ينطبق. الحد الأدنى سطر واحد.</p>
        <div class="variants table-wrap"><table><thead><tr><th>المقاس</th><th>اللون</th><th>المخزون</th><th>سعر خاص</th><th>SKU</th><th>ظاهر</th><th></th></tr></thead>
        <tbody id="variantRows">${(p.product_variants || []).slice().sort((a, b) => a.sort_order - b.sort_order).map(variantRow).join('') || variantRow()}</tbody></table></div>
        <button type="button" class="btn btn-outline btn-sm" id="addVariant" style="margin-top:8px">+ إضافة خيار</button>
        <button type="button" class="btn btn-outline btn-sm" id="addSizes" style="margin-top:8px">+ أعمار 2–11 سنة</button>
        <button type="button" class="btn btn-outline btn-sm" id="addBabySizes" style="margin-top:8px">+ مواليد 0–24 شهر</button>

        <h3 style="margin-top:18px">الصور</h3>
        <div class="images" id="imageList"></div>
        <label class="dropzone" style="margin-top:10px;display:block">اضغطي لاختيار الصور (JPG/PNG/WebP) — تُصغَّر تلقائياً<input type="file" id="imageInput" accept="image/*" multiple hidden></label>

        <div class="alert" id="formError" hidden></div>
        <div class="actions">
            ${isNew ? '' : '<button type="button" class="btn btn-danger" id="deleteProduct">حذف المنتج</button>'}
            <button type="button" class="btn btn-outline" id="cancelEdit">إلغاء</button>
            <button type="submit" class="btn btn-primary" id="saveProduct">حفظ</button>
        </div>
    </form>`);

    const renderImages = () => {
        const list = $('#imageList', body);
        list.innerHTML = [
            ...images.map((im, i) => `<div class="img-item" data-i="${i}"><img src="${esc(imgUrl(im.path))}" alt=""><div class="tools"><button type="button" data-act="left" title="قبل">◀</button><button type="button" data-act="del" title="حذف">✕</button><button type="button" data-act="right" title="بعد">▶</button></div></div>`),
            ...pendingFiles.map((f, i) => `<div class="img-item" data-p="${i}"><img src="${esc(f.preview)}" alt=""><div class="tools"><span class="small muted">جديدة</span><button type="button" data-act="pdel" title="حذف">✕</button></div></div>`),
        ].join('') || '<span class="small muted">لا توجد صور — ستظهر بطاقة المنتج بشعار مؤقت.</span>';
    };
    renderImages();

    $('#imageList', body).addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const item = b.closest('.img-item');
        const act = b.dataset.act;
        if (act === 'pdel') { pendingFiles.splice(+item.dataset.p, 1); }
        else {
            const i = +item.dataset.i;
            if (act === 'del') { const [rm] = images.splice(i, 1); if (rm.id) removedImages.push(rm); }
            // في RTL: "قبل" يعني الترتيب الأصغر (يمين)
            if (act === 'left' && i > 0) [images[i - 1], images[i]] = [images[i], images[i - 1]];
            if (act === 'right' && i < images.length - 1) [images[i + 1], images[i]] = [images[i], images[i + 1]];
        }
        renderImages();
    });
    $('#imageInput', body).addEventListener('change', async e => {
        for (const file of e.target.files) {
            try {
                const blob = await resizeImage(file, 1600, 0.85);
                pendingFiles.push({ blob, preview: URL.createObjectURL(blob) });
            } catch { toast('تعذّر قراءة إحدى الصور', true); }
        }
        e.target.value = '';
        renderImages();
    });
    $('#addVariant', body).addEventListener('click', () => $('#variantRows', body).insertAdjacentHTML('beforeend', variantRow()));
    const addSizes = (sizes) => {
        const rows = $('#variantRows', body);
        const existing = $$('tr', rows).map(tr => $('[name=size]', tr).value.trim());
        for (const s of sizes) if (!existing.includes(s)) rows.insertAdjacentHTML('beforeend', variantRow({ size: s, stock: 0 }));
        // إزالة السطر الفارغ الأول إن كان بلا بيانات
        const first = $('tr', rows);
        if (first && !$('[name=size]', first).value && !$('[name=color]', first).value && !first.dataset.vid && $$('tr', rows).length > 1) first.remove();
    };
    $('#addSizes', body).addEventListener('click', () => addSizes(['2-3 سنوات', '4-5 سنوات', '6-7 سنوات', '8-9 سنوات', '10-11 سنة']));
    $('#addBabySizes', body).addEventListener('click', () => addSizes(['0-3 أشهر', '3-6 أشهر', '6-12 شهر', '12-18 شهر', '18-24 شهر']));
    $('#variantRows', body).addEventListener('click', e => {
        const b = e.target.closest('[data-del]'); if (!b) return;
        if ($$('tr', $('#variantRows', body)).length === 1) { toast('يلزم خيار واحد على الأقل', true); return; }
        b.closest('tr').remove();
    });
    $('#cancelEdit', body).addEventListener('click', closeModal);
    $('#deleteProduct', body)?.addEventListener('click', async () => {
        if (!await confirmDialog(`حذف «${p.name}» نهائياً؟ الطلبات السابقة تحتفظ باسمه، لكن صوره ومقاساته ستُحذف.`)) return;
        const paths = images.map(i => i.path);
        const { error } = await sb.from('products').delete().eq('id', p.id);
        if (error) { toast(errMsg(error), true); return; }
        if (paths.length) await sb.storage.from('product-images').remove(paths);
        toast('حُذف المنتج');
        closeModal();
        route();
    });

    $('#productForm', body).addEventListener('submit', async e => {
        e.preventDefault();
        const err = $('#formError', body);
        err.hidden = true;
        const fd = new FormData(e.target);
        const rows = $$('#variantRows tr', body).map(tr => ({
            id: tr.dataset.vid || null,
            size: $('[name=size]', tr).value.trim(),
            color: $('[name=color]', tr).value.trim(),
            stock: Math.max(0, parseInt($('[name=stock]', tr).value || '0', 10)),
            price_override: $('[name=price_override]', tr).value === '' ? null : Number($('[name=price_override]', tr).value),
            sku: $('[name=sku]', tr).value.trim() || null,
            is_active: $('[name=is_active]', tr).checked,
        }));
        const keys = rows.map(r => r.size + '|' + r.color);
        if (new Set(keys).size !== keys.length) { err.textContent = 'يوجد خياران بنفس المقاس واللون'; err.hidden = false; return; }
        const price = Number(fd.get('price'));
        const cmp = fd.get('compare_at_price') === '' ? null : Number(fd.get('compare_at_price'));
        if (cmp !== null && cmp <= price) { err.textContent = 'السعر قبل الخصم يجب أن يكون أكبر من السعر'; err.hidden = false; return; }

        const btn = $('#saveProduct', body);
        btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
        try {
            const record = {
                name: fd.get('name').trim(), description: fd.get('description').trim() || null,
                price, compare_at_price: cmp, category_id: fd.get('category_id') || null,
                is_active: fd.get('is_active') === 'on', is_featured: fd.get('is_featured') === 'on',
                sort_order: parseInt(fd.get('sort_order') || '0', 10),
            };
            let productId = p.id;
            if (isNew) {
                const { data, error } = await sb.from('products').insert(record).select('id').single();
                if (error) throw error;
                productId = data.id;
            } else {
                const { error } = await sb.from('products').update(record).eq('id', productId);
                if (error) throw error;
            }

            // المقاسات: تحديث الموجود، إدراج الجديد، حذف المحذوف
            const keepIds = rows.filter(r => r.id).map(r => r.id);
            const oldIds = (p.product_variants || []).map(v => v.id);
            const toDelete = oldIds.filter(id => !keepIds.includes(id));
            if (toDelete.length) { const { error } = await sb.from('product_variants').delete().in('id', toDelete); if (error) throw error; }
            for (let i = 0; i < rows.length; i++) {
                const r = { ...rows[i], product_id: productId, sort_order: i };
                const id = r.id; delete r.id;
                const { error } = id ? await sb.from('product_variants').update(r).eq('id', id) : await sb.from('product_variants').insert(r);
                if (error) throw error;
            }

            // الصور: رفع الجديدة، حذف المحذوفة، تحديث الترتيب
            for (const f of pendingFiles) {
                const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
                const { error: upErr } = await sb.storage.from('product-images').upload(path, f.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
                if (upErr) throw upErr;
                images.push({ path, product_id: productId });
            }
            if (removedImages.length) {
                const { error } = await sb.from('product_images').delete().in('id', removedImages.map(i => i.id));
                if (error) throw error;
                await sb.storage.from('product-images').remove(removedImages.map(i => i.path));
            }
            for (let i = 0; i < images.length; i++) {
                const im = images[i];
                const { error } = im.id
                    ? await sb.from('product_images').update({ sort_order: i }).eq('id', im.id)
                    : await sb.from('product_images').insert({ product_id: productId, path: im.path, sort_order: i });
                if (error) throw error;
            }
            toast(isNew ? 'أُضيف المنتج' : 'تم الحفظ');
            closeModal();
            route();
        } catch (e2) {
            err.textContent = errMsg(e2); err.hidden = false;
            btn.disabled = false; btn.textContent = 'حفظ';
        }
    });
}

// تصغير الصورة في المتصفح (أطول ضلع = max) وتحويلها JPEG
function resizeImage(file, max, quality) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
        img.src = url;
    });
}
