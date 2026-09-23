-- 002_place_order_search_path — إصلاح: gen_random_bytes تعيش في مخطط extensions على Supabase،
-- ودالة place_order كانت تقصر مسار البحث على public فتفشل عند توليد رمز الوصول.
-- طُبّقت على المشروع الحي بتاريخ 2026-09-23 باسم place_order_search_path.

-- ---------- إنشاء الطلب (الزائر) ----------
-- المدخل: {customer_name, customer_phone, customer_email?, city, district?, address, notes?,
--          payment_method: gateway|bank_transfer|cod, items: [{variant_id, qty}]}
-- يحسب الأسعار من القاعدة، يقفل المتغيرات، يحجز المخزون، ويعيد رقم الطلب ورمز الوصول.
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as
$$
declare
    v_name      text := nullif(btrim(p->>'customer_name'), '');
    v_phone     text := public.normalize_phone(p->>'customer_phone');
    v_email     text := nullif(btrim(p->>'customer_email'), '');
    v_city      text := nullif(btrim(p->>'city'), '');
    v_district  text := nullif(btrim(p->>'district'), '');
    v_address   text := nullif(btrim(p->>'address'), '');
    v_notes     text := nullif(btrim(p->>'notes'), '');
    v_method    text := p->>'payment_method';
    v_items     jsonb := p->'items';
    v_line      record;
    v_var       record;
    v_subtotal  numeric(10,2) := 0;
    v_fee       numeric(10,2);
    v_free_over numeric;
    v_total     numeric(10,2);
    v_vat_rate  numeric;
    v_vat       numeric(10,2) := 0;
    v_order_id  uuid := gen_random_uuid();
    v_order_no  text;
    v_token     text := encode(gen_random_bytes(16), 'hex');
    v_recent    integer;
    v_count     integer := 0;
begin
    perform set_config('bellarosa.internal', '1', true);

    if v_name is null or length(v_name) > 80 then
        raise exception 'الاسم مطلوب';
    end if;
    if v_phone is null then
        raise exception 'رقم الجوال غير صحيح (مثال: 05xxxxxxxx)';
    end if;
    if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
        raise exception 'البريد الإلكتروني غير صحيح';
    end if;
    if v_address is null or length(v_address) > 300 then
        raise exception 'العنوان مطلوب';
    end if;
    if v_district is not null and length(v_district) > 80 then
        raise exception 'اسم الحي طويل';
    end if;
    if v_notes is not null and length(v_notes) > 500 then
        raise exception 'الملاحظات طويلة';
    end if;
    if v_method is null or v_method not in ('gateway', 'bank_transfer', 'cod') then
        raise exception 'طريقة الدفع غير صحيحة';
    end if;
    if coalesce(public.setting(case v_method when 'gateway' then 'pay_gateway'
                                             when 'bank_transfer' then 'pay_bank'
                                             else 'pay_cod' end), '0') <> '1' then
        raise exception 'طريقة الدفع غير متاحة حالياً';
    end if;
    if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
        raise exception 'السلة فارغة';
    end if;
    if jsonb_array_length(v_items) > 30 then
        raise exception 'عدد الأصناف في الطلب كبير';
    end if;
    if exists (
        select 1 from jsonb_array_elements(v_items) e
        where (e->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or (e->>'qty') !~ '^[0-9]{1,3}$'
    ) then
        raise exception 'بيانات السلة غير صحيحة';
    end if;

    select fee into v_fee from public.shipping_rates where is_active and city = v_city;
    if v_fee is null then
        raise exception 'المدينة غير مدعومة للشحن حالياً';
    end if;

    -- حد بسيط ضد العبث: خمسة طلبات في الساعة لنفس الرقم
    select count(*) into v_recent from public.orders
     where customer_phone = v_phone and created_at > now() - interval '1 hour';
    if v_recent >= 5 then
        raise exception 'تجاوزت عدد الطلبات المسموح به، تواصلي معنا عبر واتساب';
    end if;

    v_order_no := 'BR-' || nextval('public.order_no_seq');

    insert into public.orders (id, order_no, payment_method, customer_name, customer_phone, customer_email,
                               city, district, address, notes, subtotal, shipping_fee, total, access_token)
    values (v_order_id, v_order_no, v_method, v_name, v_phone, v_email,
            v_city, v_district, v_address, v_notes, 0, 0, 0, v_token);

    for v_line in
        select (e->>'variant_id')::uuid as variant_id, sum((e->>'qty')::int) as qty
          from jsonb_array_elements(v_items) e
         group by 1
    loop
        if v_line.qty < 1 or v_line.qty > 10 then
            raise exception 'الكمية المسموحة لكل صنف من 1 إلى 10';
        end if;

        select v.id, v.product_id, v.size, v.color, v.stock,
               coalesce(v.price_override, pr.price) as unit_price, pr.name
          into v_var
          from public.product_variants v
          join public.products pr on pr.id = v.product_id
         where v.id = v_line.variant_id and v.is_active and pr.is_active
           for update of v;
        if not found then
            raise exception 'أحد الأصناف لم يعد متاحاً، حدّثي السلة';
        end if;
        if v_var.stock < v_line.qty then
            raise exception 'الكمية المطلوبة من «%» غير متوفرة (المتاح: %)', v_var.name, v_var.stock;
        end if;

        insert into public.order_items (order_id, variant_id, product_id, product_name, size, color,
                                        unit_price, qty, line_total)
        values (v_order_id, v_var.id, v_var.product_id, v_var.name, nullif(v_var.size, ''), nullif(v_var.color, ''),
                v_var.unit_price, v_line.qty, round(v_var.unit_price * v_line.qty, 2));

        update public.product_variants set stock = stock - v_line.qty where id = v_var.id;
        insert into public.stock_movements (variant_id, delta, reason, order_id, actor_name)
        values (v_var.id, -v_line.qty, 'order', v_order_id, 'الزبونة');

        v_subtotal := v_subtotal + round(v_var.unit_price * v_line.qty, 2);
        v_count := v_count + 1;
    end loop;

    v_free_over := nullif(public.setting('free_shipping_over'), '')::numeric;
    if v_free_over is not null and v_subtotal >= v_free_over then
        v_fee := 0;
    end if;
    v_total := v_subtotal + v_fee;

    if coalesce(public.setting('vat_enabled'), '1') = '1' then
        v_vat_rate := coalesce(nullif(public.setting('vat_rate'), '')::numeric, 15);
        v_vat := round(v_total - v_total / (1 + v_vat_rate / 100), 2);
    end if;

    update public.orders
       set subtotal = v_subtotal, shipping_fee = v_fee, total = v_total, vat_amount = v_vat,
           payment_status = case when v_method = 'gateway' then 'pending' else 'unpaid' end
     where id = v_order_id;

    insert into public.order_events (order_id, event, details, actor_name)
    values (v_order_id, 'created', v_count || ' صنف — ' || v_total || ' ر.س', 'الزبونة');

    perform set_config('bellarosa.internal', '', true);

    return jsonb_build_object(
        'id', v_order_id, 'order_no', v_order_no, 'access_token', v_token,
        'subtotal', v_subtotal, 'shipping_fee', v_fee, 'total', v_total, 'vat_amount', v_vat,
        'payment_method', v_method
    );
end
$$;

