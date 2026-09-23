-- إضافة موظفة (أو مدير) بكلمة مرور مؤقتة تُجبر على تغييرها عند أول دخول.
-- يُنفَّذ في SQL Editor (أو عبر Supabase MCP). عدّل القيم الأربع في أول الكتلة فقط.
-- بديل لصفحة Authentication → Add user في لوحة Supabase، ويعطي النتيجة نفسها (حساب دخول + ملف موظف).
-- حتى تُبنى إدارة الموظفين من اللوحة (المرحلة 3) هذه هي الطريقة المعتمدة.

do $$
declare
    v_username text := 'noura';          -- اسم الدخول (حروف لاتينية صغيرة وأرقام فقط)
    v_fullname text := 'نورة';           -- الاسم الظاهر في اللوحة والسجلات
    v_role     text := 'staff';          -- 'staff' أو 'admin'
    v_temp     text := 'Rosa-1234-Temp'; -- كلمة مرور مؤقتة (8 خانات فأكثر) تُبلَّغ بها الموظفة وتغيّرها فوراً
    v_email    text;
    v_uid      uuid := gen_random_uuid();
begin
    if v_username !~ '^[a-z0-9][a-z0-9._-]{1,30}$' then raise exception 'اسم المستخدم غير صالح: %', v_username; end if;
    if v_role not in ('staff', 'admin') then raise exception 'الدور يجب أن يكون staff أو admin'; end if;
    if length(v_temp) < 8 then raise exception 'كلمة المرور المؤقتة أقصر من 8 خانات'; end if;
    v_email := v_username || '@users.bellarosa.sa';
    if exists (select 1 from auth.users where email = v_email) then raise exception 'الحساب موجود مسبقاً: %', v_email; end if;

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token,
        is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, extensions.crypt(v_temp, extensions.gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', '', '', '', '', '', false, false);

    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
            'email', now(), now(), now());

    insert into public.profiles (id, username, fullname, role, must_change_password)
    values (v_uid, v_username, v_fullname, v_role, true);

    raise notice 'تم: % (%) — الدخول باسم % وكلمة المرور المؤقتة، وستُطلب كلمة مرور جديدة فوراً', v_fullname, v_role, v_username;
end $$;

-- حظر موظفة:      update public.profiles set is_blocked = true  where username = 'noura';
-- إعادة تفعيلها:  update public.profiles set is_blocked = false where username = 'noura';
-- إعادة تعيين كلمة مرور مؤقتة لموظفة نسيت كلمتها (ثم تُجبر على تغييرها):
--   update auth.users set encrypted_password = extensions.crypt('Rosa-5678-Temp', extensions.gen_salt('bf', 10)), updated_at = now()
--   where email = 'noura@users.bellarosa.sa';
--   update public.profiles set must_change_password = true where username = 'noura';
