-- اختبارات قاعدة البيانات (الصلاحيات + إنشاء الطلب + دورة الإلغاء) — تُنفَّذ في SQL Editor أو عبر Supabase MCP
-- بحساب postgres، وتبدّل الدور إلى anon/authenticated داخلها لمحاكاة الزائر والموظف.
-- تحتاج بيانات scripts/seed-demo.sql. تُنشئ موظفاً وهمياً وطلبات ثم تحذفها في النهاية.
-- النتيجة: صف لكل اختبار يبدأ بـ PASS، وأي فشل يوقف التنفيذ برسالة FAIL (وتُلغى كل التغييرات).

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as
$$
declare
    r          text[] := '{}';
    v_uid      uuid := gen_random_uuid();
    v_email    text := 'test_staff_' || substr(v_uid::text, 1, 8) || '@users.bellarosa.sa';
    v_phone    text := '0500000099';
    v_var_m1   uuid;   -- فستان 1 مقاس M
    v_var_s1   uuid;   -- فستان 1 مقاس S (نافد)
    v_var_m3   uuid;   -- فستان 3 مقاس M
    v_stock0   integer;
    v_res      jsonb;
    v_order_no text;
    v_token    text;
    v_order_id uuid;
    v_n        integer;
    v_t        numeric;
    v_started  timestamptz := clock_timestamp();
begin
    select id into v_var_m1 from public.product_variants where product_id = 'c0000000-0000-4000-8000-000000000001' and size = 'M';
    select id into v_var_s1 from public.product_variants where product_id = 'c0000000-0000-4000-8000-000000000001' and size = 'S';
    select id into v_var_m3 from public.product_variants where product_id = 'c0000000-0000-4000-8000-000000000003' and size = 'M';
    select stock into v_stock0 from public.product_variants where id = v_var_m1;

    -- موظف وهمي (يُحذف في النهاية)
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
            crypt(encode(gen_random_bytes(12), 'hex'), gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into public.profiles (id, username, fullname, role) values (v_uid, 'test_staff', 'موظف اختبار', 'staff');

    -- ===== الزائر =====
    execute 'set local role anon';

    select count(*) into v_n from public.products;
    if v_n <> 8 then raise exception 'FAIL T1: anon يرى % منتجاً بدل 8', v_n; end if;
    r := array_append(r, 'PASS T1 الزائر يرى المنتجات الفعّالة (' || v_n || ')');

    begin
        select count(*) into v_n from public.orders;
        raise exception 'FAIL T2: anon قرأ الطلبات';
    exception when insufficient_privilege then
        r := array_append(r, 'PASS T2 الزائر لا يقرأ الطلبات');
    end;

    begin
        update public.products set price = 1 where id = 'c0000000-0000-4000-8000-000000000001';
        raise exception 'FAIL T3: anon عدّل سعراً';
    exception when insufficient_privilege then
        r := array_append(r, 'PASS T3 الزائر لا يعدّل الأسعار');
    end;

    begin
        insert into public.order_events (order_id, event) values (gen_random_uuid(), 'note');
        raise exception 'FAIL T4: anon كتب في سجل الأحداث';
    exception when insufficient_privilege then
        r := array_append(r, 'PASS T4 الزائر لا يكتب في سجل الأحداث');
    end;

    v_res := public.place_order(jsonb_build_object(
        'customer_name', 'زبونة اختبار', 'customer_phone', '+966 50 000 0099',
        'city', 'الرياض', 'address', 'حي الياسمين، شارع 12', 'payment_method', 'cod',
        'items', jsonb_build_array(
            jsonb_build_object('variant_id', v_var_m1, 'qty', 1),
            jsonb_build_object('variant_id', v_var_m3, 'qty', 2))));
    v_order_no := v_res->>'order_no';
    v_token := v_res->>'access_token';
    v_order_id := (v_res->>'id')::uuid;
    if (v_res->>'subtotal')::numeric <> 1370 or (v_res->>'shipping_fee')::numeric <> 25
       or (v_res->>'total')::numeric <> 1395 or (v_res->>'vat_amount')::numeric <> 181.96 then
        raise exception 'FAIL T5: مبالغ غير صحيحة %', v_res;
    end if;
    r := array_append(r, 'PASS T5 إنشاء طلب: ' || v_order_no || ' — الإجمالي 1395 والضريبة 181.96 محسوبة في السيرفر');

    select stock into v_n from public.product_variants where id = v_var_m1;
    if v_n <> v_stock0 - 1 then raise exception 'FAIL T6: المخزون لم يُحجز (% بدل %)', v_n, v_stock0 - 1; end if;
    r := array_append(r, 'PASS T6 المخزون حُجز عند الطلب');

    begin
        perform public.place_order(jsonb_build_object('customer_name', 'x', 'customer_phone', v_phone, 'city', 'الرياض',
            'address', 'y', 'payment_method', 'gateway', 'items', jsonb_build_array(jsonb_build_object('variant_id', v_var_m1, 'qty', 1))));
        raise exception 'FAIL T7: قُبل الدفع الإلكتروني وهو معطّل';
    exception when others then
        if sqlerrm not like '%غير متاحة%' then raise exception 'FAIL T7: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T7 طريقة الدفع المعطّلة تُرفض');
    end;

    begin
        perform public.place_order(jsonb_build_object('customer_name', 'x', 'customer_phone', '12345', 'city', 'الرياض',
            'address', 'y', 'payment_method', 'cod', 'items', jsonb_build_array(jsonb_build_object('variant_id', v_var_m1, 'qty', 1))));
        raise exception 'FAIL T8: قُبل رقم جوال خاطئ';
    exception when others then
        if sqlerrm not like '%الجوال%' then raise exception 'FAIL T8: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T8 رقم الجوال الخاطئ يُرفض');
    end;

    begin
        perform public.place_order(jsonb_build_object('customer_name', 'x', 'customer_phone', v_phone, 'city', 'باريس',
            'address', 'y', 'payment_method', 'cod', 'items', jsonb_build_array(jsonb_build_object('variant_id', v_var_m1, 'qty', 1))));
        raise exception 'FAIL T9: قُبلت مدينة غير مدعومة';
    exception when others then
        if sqlerrm not like '%المدينة%' then raise exception 'FAIL T9: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T9 المدينة غير المدعومة تُرفض');
    end;

    begin
        perform public.place_order(jsonb_build_object('customer_name', 'x', 'customer_phone', v_phone, 'city', 'الرياض',
            'address', 'y', 'payment_method', 'cod', 'items', jsonb_build_array(jsonb_build_object('variant_id', v_var_s1, 'qty', 1))));
        raise exception 'FAIL T10: قُبل مقاس نافد';
    exception when others then
        if sqlerrm not like '%غير متوفرة%' then raise exception 'FAIL T10: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T10 المقاس النافد يُرفض');
    end;

    begin
        perform public.place_order(jsonb_build_object('customer_name', 'x', 'customer_phone', v_phone, 'city', 'الرياض',
            'address', 'y', 'payment_method', 'cod', 'items', jsonb_build_array(jsonb_build_object('variant_id', v_var_m3, 'qty', 11))));
        raise exception 'FAIL T11: قُبلت كمية 11';
    exception when others then
        if sqlerrm not like '%الكمية المسموحة%' then raise exception 'FAIL T11: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T11 الكمية فوق 10 تُرفض');
    end;

    begin
        perform public.place_order(jsonb_build_object('customer_name', 'x', 'customer_phone', v_phone, 'city', 'الرياض',
            'address', 'y', 'payment_method', 'cod', 'items', jsonb_build_array(jsonb_build_object('variant_id', 'abc', 'qty', 1))));
        raise exception 'FAIL T12: قُبل معرّف غير صحيح';
    exception when others then
        if sqlerrm not like '%السلة غير صحيحة%' then raise exception 'FAIL T12: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T12 بيانات السلة العبثية تُرفض');
    end;

    v_res := public.get_order(v_order_no, v_token);
    if v_res is null or (v_res->>'total')::numeric <> 1395 or jsonb_array_length(v_res->'items') <> 2 then
        raise exception 'FAIL T13: get_order بالرمز أعاد %', v_res;
    end if;
    if public.get_order(v_order_no, 'wrong') is not null then raise exception 'FAIL T13: رمز خاطئ قُبل'; end if;
    if public.get_order(replace(v_order_no, 'BR-', ''), '٠٥٠٠٠٠٠٠٩٩') is null then raise exception 'FAIL T13: البحث بالجوال بالأرقام العربية فشل'; end if;
    r := array_append(r, 'PASS T13 صفحة الطلب: بالرمز أو بالجوال فقط');

    -- ===== الموظف =====
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

    select count(*) into v_n from public.orders where id = v_order_id;
    if v_n <> 1 then raise exception 'FAIL T14: الموظف لا يرى الطلب'; end if;
    r := array_append(r, 'PASS T14 الموظف يرى الطلبات');

    update public.orders set status = 'confirmed', total = 1 where id = v_order_id;
    select total into v_t from public.orders where id = v_order_id;
    if v_t <> 1395 then raise exception 'FAIL T15: الإجمالي تغيّر إلى %', v_t; end if;
    select count(*) into v_n from public.order_events where order_id = v_order_id and event = 'status' and details = 'confirmed' and actor_name = 'موظف اختبار';
    if v_n <> 1 then raise exception 'FAIL T15: حدث التأكيد لم يُسجَّل باسم الموظف'; end if;
    r := array_append(r, 'PASS T15 تغيير الحالة يُسجَّل باسم الموظف، والمبالغ لا تتغير');

    update public.orders set payment_status = 'paid' where id = v_order_id;
    select count(*) into v_n from public.orders where id = v_order_id and paid_at is not null;
    if v_n <> 1 then raise exception 'FAIL T16: paid_at لم يُضبط'; end if;
    r := array_append(r, 'PASS T16 تأكيد الدفع يضبط تاريخ الدفع');

    update public.orders set status = 'cancelled' where id = v_order_id;
    select stock into v_n from public.product_variants where id = v_var_m1;
    if v_n <> v_stock0 then raise exception 'FAIL T17: المخزون لم يُرجَع (% بدل %)', v_n, v_stock0; end if;
    select count(*) into v_n from public.stock_movements where order_id = v_order_id and reason = 'cancel';
    if v_n <> 2 then raise exception 'FAIL T17: حركات الإلغاء % بدل 2', v_n; end if;
    select count(*) into v_n from public.orders where id = v_order_id and stock_restored;
    if v_n <> 1 then raise exception 'FAIL T17: stock_restored لم يُضبط'; end if;
    r := array_append(r, 'PASS T17 الإلغاء يرجع المخزون ويسجّل الحركة مرة واحدة');

    begin
        update public.orders set status = 'new' where id = v_order_id;
        raise exception 'FAIL T18: أُعيد فتح طلب ملغى';
    exception when others then
        if sqlerrm not like '%ملغى%' then raise exception 'FAIL T18: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T18 الملغى لا يُعاد فتحه');
    end;

    update public.settings set value = 'x' where key = 'store_name';
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'FAIL T19: الموظف عدّل الإعدادات'; end if;
    r := array_append(r, 'PASS T19 الإعدادات للمدير فقط');

    insert into public.order_events (order_id, event, details) values (v_order_id, 'note', 'اتصلت بالزبونة');
    begin
        insert into public.order_events (order_id, event, details) values (v_order_id, 'payment', 'paid');
        raise exception 'FAIL T20: الموظف كتب حدث دفع يدوياً';
    exception when others then
        if sqlerrm not like '%policy%' then raise exception 'FAIL T20: رسالة غير متوقعة %', sqlerrm; end if;
        r := array_append(r, 'PASS T20 الموظف يضيف ملاحظة فقط، لا أحداث دفع');
    end;

    -- الموظف المعطَّل يُعامل كمجهول
    execute 'reset role';
    update public.profiles set is_blocked = true where id = v_uid;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    select count(*) into v_n from public.orders;
    if v_n <> 0 then raise exception 'FAIL T21: الموظف المعطَّل يرى الطلبات'; end if;
    r := array_append(r, 'PASS T21 الموظف المعطَّل لا يرى شيئاً');

    -- ===== التنظيف =====
    execute 'reset role';
    delete from public.stock_movements where created_at >= v_started and reason in ('order', 'cancel');
    delete from public.orders where customer_phone = v_phone;
    delete from auth.users where id = v_uid;
    r := array_append(r, 'PASS تنظيف: حُذف الطلب والموظف الوهمي');

    return query select unnest(r);
end
$$;

select * from pg_temp.run_tests();
