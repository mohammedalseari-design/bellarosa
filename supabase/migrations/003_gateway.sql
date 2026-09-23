-- 003_gateway — المرحلة 2 (الدفع الإلكتروني): تهيئة قاعدة البيانات لبوابة الدفع.
-- طُبّقت على المشروع الحي بتاريخ 2026-09-23 باسم gateway.
--
--   (1) عملية الدفع الواحدة لا تُستخدم لأكثر من طلب.
--   (2) get_order يعيد رمز الوصول أيضاً عند البحث برقم الطلب + الجوال، لأن صفحة الطلب تحتاجه لعرض نموذج الدفع
--       والتحقق منه عبر Edge Function (moyasar-verify). المعرفة بالرقم والجوال هي التحقق نفسه.
--       ويعيد id الطلب لأن نموذج الدفع يرسله في metadata وتقارنه الدالة.

create unique index if not exists orders_gateway_payment_idx
    on public.orders (gateway_payment_id) where gateway_payment_id is not null;

create or replace function public.get_order(p_order_no text, p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
    v_o     public.orders%rowtype;
    v_no    text := upper(translate(btrim(coalesce(p_order_no, '')), '٠١٢٣٤٥٦٧٨٩', '0123456789'));
    v_key   text := btrim(coalesce(p_key, ''));
    v_phone text := public.normalize_phone(p_key);
begin
    if v_no ~ '^[0-9]+$' then
        v_no := 'BR-' || v_no;
    end if;
    select * into v_o from public.orders
     where order_no = v_no
       and (access_token = v_key or (v_phone is not null and customer_phone = v_phone));
    if not found then
        return null;
    end if;

    return jsonb_build_object(
        'id', v_o.id, 'order_no', v_o.order_no, 'status', v_o.status, 'access_token', v_o.access_token,
        'payment_method', v_o.payment_method, 'payment_status', v_o.payment_status,
        'customer_name', v_o.customer_name, 'customer_phone', v_o.customer_phone,
        'city', v_o.city, 'district', v_o.district, 'address', v_o.address, 'notes', v_o.notes,
        'subtotal', v_o.subtotal, 'shipping_fee', v_o.shipping_fee, 'discount', v_o.discount,
        'total', v_o.total, 'vat_amount', v_o.vat_amount,
        'created_at', v_o.created_at, 'paid_at', v_o.paid_at,
        'items', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'product_id', i.product_id, 'product_name', i.product_name, 'size', i.size, 'color', i.color,
                'unit_price', i.unit_price, 'qty', i.qty, 'line_total', i.line_total,
                'image', (select im.path from public.product_images im
                           where im.product_id = i.product_id order by im.sort_order limit 1)
            ) order by i.product_name), '[]'::jsonb)
            from public.order_items i where i.order_id = v_o.id
        ),
        'events', (
            select coalesce(jsonb_agg(jsonb_build_object('event', e.event, 'details', e.details, 'created_at', e.created_at)
                            order by e.created_at), '[]'::jsonb)
            from public.order_events e where e.order_id = v_o.id and e.event in ('created', 'status', 'payment')
        )
    );
end
$$;
