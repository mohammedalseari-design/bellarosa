-- ============================================================
-- بيلا روزا — متجر فساتين وملابس نسائية — قاعدة البيانات على Supabase
-- 001_init: الجداول + الدوال + المشغّلات + الصلاحيات (RLS) + مخزن الصور
-- المبدأ نفسه المتّبع في ملائم: كل التحقق والحسابات المالية في السيرفر، والمتصفح لا يُصدَّق.
--   • الزائر (anon) يقرأ الكتالوج فقط، ويُنشئ طلباً عبر دالة place_order التي تحسب الأسعار
--     من قاعدة البيانات لا من السلة المرسلة، وتقفل المخزون أثناء الحجز.
--   • الموظف (authenticated + profiles) يدير المنتجات والطلبات، ولا يستطيع تغيير مبالغ طلب قائم.
--   • الأسعار شاملة ضريبة القيمة المضافة (15٪) كما هو معتاد في البيع للمستهلك.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- الجداول ----------

-- ملف الموظف: مربوط بحساب الدخول في auth.users (اسم المستخدم يُحوَّل لإيميل داخلي)
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    username    text not null unique,
    fullname    text,
    role        text not null check (role in ('admin', 'staff')),
    is_blocked  boolean not null default false,
    created_at  timestamptz not null default now()
);

-- إعدادات المتجر: is_public = true يقرأه الزائر (اسم المتجر، واتساب، بيانات التحويل، طرق الدفع المفعّلة)
create table if not exists public.settings (
    key        text primary key,
    value      text,
    is_public  boolean not null default false
);

create table if not exists public.categories (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    slug        text unique,
    sort_order  integer not null default 0,
    is_active   boolean not null default true,
    created_at  timestamptz not null default now()
);

create table if not exists public.products (
    id                uuid primary key default gen_random_uuid(),
    category_id       uuid references public.categories (id) on delete set null,
    name              text not null,
    slug              text unique,
    description       text,
    price             numeric(10,2) not null check (price >= 0),          -- شامل الضريبة
    compare_at_price  numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
    is_active         boolean not null default true,
    is_featured       boolean not null default false,
    sort_order        integer not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx   on public.products (is_active, sort_order);

-- المتغيرات: كل مقاس/لون له مخزونه وسعره الاختياري
create table if not exists public.product_variants (
    id              uuid primary key default gen_random_uuid(),
    product_id      uuid not null references public.products (id) on delete cascade,
    size            text not null default '',
    color           text not null default '',
    sku             text unique,
    stock           integer not null default 0 check (stock >= 0),
    price_override  numeric(10,2) check (price_override is null or price_override >= 0),
    is_active       boolean not null default true,
    sort_order      integer not null default 0,
    unique (product_id, size, color)
);
create index if not exists variants_product_idx on public.product_variants (product_id);

create table if not exists public.product_images (
    id          uuid primary key default gen_random_uuid(),
    product_id  uuid not null references public.products (id) on delete cascade,
    path        text not null,                 -- مسار الملف داخل مخزن product-images
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now()
);
create index if not exists images_product_idx on public.product_images (product_id, sort_order);

-- رسوم الشحن حسب المدينة (المدن غير المدرجة لا يُقبل الشحن إليها)
create table if not exists public.shipping_rates (
    id          uuid primary key default gen_random_uuid(),
    city        text not null unique,
    fee         numeric(10,2) not null check (fee >= 0),
    is_active   boolean not null default true,
    sort_order  integer not null default 0
);

create sequence if not exists public.order_no_seq start 1001;

create table if not exists public.orders (
    id                  uuid primary key default gen_random_uuid(),
    order_no            text not null unique,                        -- BR-1001
    status              text not null default 'new'
                        check (status in ('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
    payment_method      text not null check (payment_method in ('gateway', 'bank_transfer', 'cod')),
    payment_status      text not null default 'unpaid'
                        check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
    gateway_payment_id  text,
    customer_name       text not null,
    customer_phone      text not null,                               -- بصيغة 05xxxxxxxx
    customer_email      text,
    city                text not null,
    district            text,
    address             text not null,
    notes               text,
    subtotal            numeric(10,2) not null,
    shipping_fee        numeric(10,2) not null,
    discount            numeric(10,2) not null default 0,
    total               numeric(10,2) not null,
    vat_amount          numeric(10,2) not null default 0,            -- الضريبة المتضمنة في الإجمالي
    access_token        text not null,                               -- لصفحة الطلب بعد الشراء
    stock_restored      boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    paid_at             timestamptz
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx  on public.orders (status);
create index if not exists orders_phone_idx   on public.orders (customer_phone);

create table if not exists public.order_items (
    id            uuid primary key default gen_random_uuid(),
    order_id      uuid not null references public.orders (id) on delete cascade,
    variant_id    uuid references public.product_variants (id) on delete set null,
    product_id    uuid references public.products (id) on delete set null,
    product_name  text not null,                                     -- لقطة وقت الطلب
    size          text,
    color         text,
    unit_price    numeric(10,2) not null,
    qty           integer not null check (qty > 0),
    line_total    numeric(10,2) not null
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- سجل أحداث الطلب (إنشاء، تغيير حالة، دفع، ملاحظة موظف)
create table if not exists public.order_events (
    id          bigint generated by default as identity primary key,
    order_id    uuid not null references public.orders (id) on delete cascade,
    event       text not null,
    details     text,
    actor_name  text,
    created_at  timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- سجل حركة المخزون (حجز طلب، إلغاء، تعديل يدوي)
create table if not exists public.stock_movements (
    id          bigint generated by default as identity primary key,
    variant_id  uuid not null references public.product_variants (id) on delete cascade,
    delta       integer not null,
    reason      text not null check (reason in ('order', 'cancel', 'adjust')),
    order_id    uuid references public.orders (id) on delete set null,
    actor_name  text,
    created_at  timestamptz not null default now()
);
create index if not exists stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);

-- ---------- دوال مساعدة ----------

-- دور الموظف الحالي (المعطَّل يُعامل كمجهول)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select p.role from public.profiles p where p.id = auth.uid() and not p.is_blocked $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() = 'admin', false) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() in ('admin', 'staff'), false) $$;

-- اسم الموظف الحالي للسجلات
create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as
$$ select coalesce(p.fullname, p.username) from public.profiles p where p.id = auth.uid() $$;

-- قراءة إعداد داخل الدوال (بغض النظر عن كونه عاماً)
create or replace function public.setting(p_key text) returns text
language sql stable security definer set search_path = public as
$$ select s.value from public.settings s where s.key = p_key $$;

-- توحيد رقم الجوال السعودي إلى 05xxxxxxxx (يقبل الأرقام العربية و +966 و 966 و 00966)
create or replace function public.normalize_phone(p text) returns text
language sql immutable as
$$
    select case
        when d ~ '^05[0-9]{8}$'     then d
        when d ~ '^5[0-9]{8}$'      then '0' || d
        when d ~ '^9665[0-9]{8}$'   then '0' || substr(d, 4)
        when d ~ '^009665[0-9]{8}$' then '0' || substr(d, 6)
        else null
    end
    from (select regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9]', '', 'g') as d) t
$$;

-- ---------- المشغّلات ----------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

-- حارس الطلبات: المبالغ لا تتغير بعد الإنشاء، الملغى لا يُعاد فتحه، وتاريخ الدفع يُضبط تلقائياً
create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
    if current_setting('bellarosa.internal', true) = '1' then
        return new; -- تحديث داخلي من place_order
    end if;

    new.id           := old.id;
    new.order_no     := old.order_no;
    new.subtotal     := old.subtotal;
    new.shipping_fee := old.shipping_fee;
    new.discount     := old.discount;
    new.total        := old.total;
    new.vat_amount   := old.vat_amount;
    new.access_token := old.access_token;
    new.created_at   := old.created_at;
    new.stock_restored := old.stock_restored;
    new.updated_at   := now();

    if old.status = 'cancelled' and new.status <> 'cancelled' then
        raise exception 'لا يمكن إعادة فتح طلب ملغى؛ أنشئ طلباً جديداً';
    end if;
    if old.status = 'delivered' and new.status = 'cancelled' then
        raise exception 'الطلب مُسلَّم؛ استخدم الاسترجاع بدل الإلغاء';
    end if;

    if new.payment_status = 'paid' and old.payment_status <> 'paid' then
        new.paid_at := now();
    elsif new.payment_status <> 'paid' then
        new.paid_at := null;
    end if;
    return new;
end
$$;

drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before update on public.orders
for each row execute function public.orders_guard();

-- بعد التحديث: تسجيل الأحداث وإرجاع المخزون عند الإلغاء
-- (العلم bellarosa.internal يُرفع أثناء الإرجاع كي يمر التحديث الداخلي من الحارس ولا يُسجَّل كتعديل يدوي، ثم يُخفض)
create or replace function public.orders_after_update() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
    v_actor text := coalesce(public.my_name(), 'النظام');
begin
    if new.status <> old.status then
        insert into public.order_events (order_id, event, details, actor_name)
        values (new.id, 'status', new.status, v_actor);
    end if;
    if new.payment_status <> old.payment_status then
        insert into public.order_events (order_id, event, details, actor_name)
        values (new.id, 'payment', new.payment_status, v_actor);
    end if;

    if new.status = 'cancelled' and not new.stock_restored then
        perform set_config('bellarosa.internal', '1', true);
        update public.product_variants v
           set stock = v.stock + i.qty
          from public.order_items i
         where i.order_id = new.id and i.variant_id = v.id;
        insert into public.stock_movements (variant_id, delta, reason, order_id, actor_name)
        select i.variant_id, i.qty, 'cancel', new.id, v_actor
          from public.order_items i where i.order_id = new.id and i.variant_id is not null;
        update public.orders set stock_restored = true where id = new.id;
        perform set_config('bellarosa.internal', '', true);
    end if;
    return null;
end
$$;

drop trigger if exists orders_after_update on public.orders;
create trigger orders_after_update after update on public.orders
for each row execute function public.orders_after_update();

-- تعديل المخزون يدوياً من اللوحة يُسجَّل كحركة
create or replace function public.variants_stock_log() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
    if current_setting('bellarosa.internal', true) = '1' then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.stock <> old.stock then
        insert into public.stock_movements (variant_id, delta, reason, actor_name)
        values (new.id, new.stock - old.stock, 'adjust', coalesce(public.my_name(), 'النظام'));
    elsif tg_op = 'INSERT' and new.stock <> 0 then
        insert into public.stock_movements (variant_id, delta, reason, actor_name)
        values (new.id, new.stock, 'adjust', coalesce(public.my_name(), 'النظام'));
    end if;
    return new;
end
$$;

drop trigger if exists variants_stock_log on public.product_variants;
create trigger variants_stock_log after insert or update on public.product_variants
for each row execute function public.variants_stock_log();

-- ---------- إنشاء الطلب (الزائر) ----------
-- المدخل: {customer_name, customer_phone, customer_email?, city, district?, address, notes?,
--          payment_method: gateway|bank_transfer|cod, items: [{variant_id, qty}]}
-- يحسب الأسعار من القاعدة، يقفل المتغيرات، يحجز المخزون، ويعيد رقم الطلب ورمز الوصول.
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as
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

-- ---------- قراءة طلب (الزائرة) برقم الطلب + رمز الوصول أو رقم الجوال ----------
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
        'order_no', v_o.order_no, 'status', v_o.status,
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

-- نبضة يومية تمنع إيقاف المشروع على الخطة المجانية (لا تقرأ أي جدول)
create or replace function public.keepalive() returns timestamptz
language sql stable as $$ select now() $$;

-- ---------- صلاحيات تنفيذ الدوال ----------
revoke all on function public.my_role(), public.is_admin(), public.is_staff(), public.my_name(),
                       public.setting(text), public.normalize_phone(text),
                       public.place_order(jsonb), public.get_order(text, text), public.keepalive()
       from public;
grant execute on function public.my_role(), public.is_admin(), public.is_staff(), public.my_name(),
                          public.normalize_phone(text)
      to authenticated;
grant execute on function public.place_order(jsonb), public.get_order(text, text), public.keepalive(),
                          public.normalize_phone(text)
      to anon, authenticated;
-- setting() داخلية: تُستدعى من دوال security definer فقط

-- ---------- الصلاحيات (Row Level Security) ----------

alter table public.profiles         enable row level security;
alter table public.settings         enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images   enable row level security;
alter table public.shipping_rates   enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_events     enable row level security;
alter table public.stock_movements  enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.settings, public.categories, public.products, public.product_variants,
                public.product_images, public.shipping_rates to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update, delete on public.settings, public.categories, public.products,
                               public.product_variants, public.product_images, public.shipping_rates
      to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.stock_movements to authenticated;
grant select, insert on public.order_events to authenticated;

-- profiles: كل موظف يرى ملفه، والمدير يرى الجميع ويعدّلهم
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- settings: العام للزائر، والكل للموظف، والتعديل للمدير
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated
using (is_public or public.is_staff());

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- الكتالوج: الفعّال للجميع، والكل للموظف، والكتابة للموظف
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to anon, authenticated
using (is_active or public.is_staff());
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select to anon, authenticated
using (is_active or public.is_staff());
drop policy if exists products_write on public.products;
create policy products_write on public.products for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists variants_read on public.product_variants;
create policy variants_read on public.product_variants for select to anon, authenticated
using (public.is_staff() or (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)));
drop policy if exists variants_write on public.product_variants;
create policy variants_write on public.product_variants for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists images_read on public.product_images;
create policy images_read on public.product_images for select to anon, authenticated
using (public.is_staff() or exists (select 1 from public.products p where p.id = product_id and p.is_active));
drop policy if exists images_write on public.product_images;
create policy images_write on public.product_images for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists shipping_read on public.shipping_rates;
create policy shipping_read on public.shipping_rates for select to anon, authenticated
using (is_active or public.is_staff());
drop policy if exists shipping_write on public.shipping_rates;
create policy shipping_write on public.shipping_rates for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- الطلبات: للموظف فقط. الإنشاء عبر place_order، ولا حذف (سجلات مالية)
drop policy if exists orders_staff_select on public.orders;
create policy orders_staff_select on public.orders for select to authenticated
using (public.is_staff());
drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders for update to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists order_items_staff on public.order_items;
create policy order_items_staff on public.order_items for select to authenticated
using (public.is_staff());

drop policy if exists order_events_staff_select on public.order_events;
create policy order_events_staff_select on public.order_events for select to authenticated
using (public.is_staff());
-- الإدراج المباشر الوحيد للموظف هو الملاحظة؛ الباقي تكتبه المشغّلات
drop policy if exists order_events_staff_note on public.order_events;
create policy order_events_staff_note on public.order_events for insert to authenticated
with check (public.is_staff() and event = 'note');

drop policy if exists stock_movements_staff on public.stock_movements;
create policy stock_movements_staff on public.stock_movements for select to authenticated
using (public.is_staff());

-- ---------- مخزن الصور ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "product images staff insert" on storage.objects;
create policy "product images staff insert" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_staff());

drop policy if exists "product images staff update" on storage.objects;
create policy "product images staff update" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_staff());

drop policy if exists "product images staff delete" on storage.objects;
create policy "product images staff delete" on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_staff());

-- ---------- الإعدادات الافتراضية ----------
insert into public.settings (key, value, is_public) values
    ('store_name',          'بيلا روزا',                         true),
    ('store_tagline',       'فساتين وملابس بذوق مختلف',          true),
    ('store_phone',         '',                                  true),
    ('store_whatsapp',      '',                                  true),   -- بصيغة 9665xxxxxxxx
    ('store_instagram',     '',                                  true),
    ('announcement',        '',                                  true),   -- شريط أعلى المتجر
    ('currency',            'ر.س',                               true),
    ('vat_enabled',         '1',                                 true),
    ('vat_rate',            '15',                                true),
    ('vat_number',          '',                                  true),
    ('free_shipping_over',  '',                                  true),
    ('pay_cod',             '1',                                 true),
    ('pay_bank',            '1',                                 true),
    ('pay_gateway',         '0',                                 true),   -- يُفعَّل في المرحلة 2 بعد ربط بوابة الدفع
    ('bank_name',           '',                                  true),
    ('bank_account_name',   '',                                  true),
    ('bank_iban',           '',                                  true),
    ('policy_returns',      'الاستبدال خلال 3 أيام من الاستلام بحالة المنتج الأصلية. لا يُسترجع ما فُصِّل حسب الطلب.', true),
    ('moyasar_publishable_key', '',                              true)    -- مفتاح النشر فقط؛ المفتاح السري في أسرار Edge Function
on conflict (key) do nothing;
