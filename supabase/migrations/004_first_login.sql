-- 004: تغيير كلمة المرور الإجباري عند أول دخول، وتغييرها من اللوحة لأي موظف.
-- الحساب الأول يُنشأ بكلمة مرور مؤقتة مع must_change_password = true؛ اللوحة لا تفتح قبل تعيين كلمة مرور جديدة.

alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- يستدعيها الموظف بعد نجاح auth.updateUser({password}) لرفع الإلزام عن نفسه فقط (لا عن غيره).
create or replace function public.password_changed() returns void
language sql security definer set search_path = public as
$$ update public.profiles set must_change_password = false where id = auth.uid() $$;

revoke all on function public.password_changed() from public;
grant execute on function public.password_changed() to authenticated;
