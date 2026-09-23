# الإعداد والتشغيل

## ما هو جاهز الآن

- مشروع Supabase «بيلا روزا» (`oxsttfljqbunanmwdzft`، منظمة mulaem، eu-central-1) مُنشأ، والهجرات `001`–`004`
  مطبّقة، والبيانات التجريبية (`scripts/seed-demo.sql`) محمّلة.
- `js/config.js` يحمل رابط المشروع والمفتاح العام.
- حساب المدير الأول `bandar` مُنشأ بكلمة مرور مؤقتة (أُبلغ بها صاحب المتجر خارج المستودع)؛ اللوحة تُجبره على تعيين
  كلمة مروره الخاصة عند أول دخول، ولا تُحفظ في أي مكان غير Supabase.

## 1. حسابات الدخول (المدير والموظفات)

الدخول للوحة الإدارة باسم مستخدم يُحوَّل داخلياً إلى إيميل `username@users.bellarosa.sa` (لا يلزم بريد حقيقي).

**الطريقة المعتمدة:** `scripts/add-staff.sql` في SQL Editor — عدّل اسم المستخدم والاسم الكامل والدور (`admin`/`staff`) وكلمة
مرور مؤقتة، ونفّذ. تُبلَّغ الموظفة بكلمة المرور المؤقتة، وعند أول دخول تُطلب منها كلمة مرور جديدة قبل أن تُفتح اللوحة
(`profiles.must_change_password`). في الملف نفسه أوامر الحظر وإعادة التفعيل وإعادة تعيين كلمة مرور منسية.

**بديل من لوحة Supabase:** Authentication → Users → Add user → Create new user (Email بالصيغة أعلاه + Password + Auto Confirm)،
ثم في SQL Editor:
```sql
insert into public.profiles (id, username, fullname, role, must_change_password)
select id, 'noura', 'نورة', 'staff', true from auth.users where email = 'noura@users.bellarosa.sa';
```

أي موظفة تغيّر كلمة مرورها متى شاءت من زر «كلمة المرور» في شريط اللوحة. الموظفة (`staff`) لا تعدّل الإعدادات.
حتى تُبنى إدارة الموظفين من اللوحة (المرحلة 3) هذه هي الطريقة الوحيدة.

## 2. النشر على GitHub Pages

1. ارفع المستودع إلى `github.com/mohammedalseari-design/bellarosa` (عام أو خاص — Pages يعمل مع الاثنين على الحساب الشخصي فقط إذا كان عاماً).
2. Settings → Pages → Build and deployment: **Deploy from a branch** → Branch `main` / `/ (root)` → Save.
3. بعد دقيقة: المتجر على `https://mohammedalseari-design.github.io/bellarosa/` واللوحة على `.../bellarosa/admin/`.
4. الكود يستخدم مسارات نسبية فقط، فربط نطاق خاص لاحقاً لا يحتاج تعديلاً (`docs/DOMAIN.md`).

## 3. الأسرار

- `SUPABASE_DB_URL` في GitHub (Settings → Secrets and variables → Actions) ليعمل النسخ الاحتياطي الليلي — التفاصيل في `docs/BACKUP.md`.
- المفتاح السري لبوابة الدفع (المرحلة 2) يوضع في أسرار Edge Functions في Supabase فقط: `supabase secrets set MOYASAR_SECRET_KEY=...`.
- **لا يدخل المستودع أي سر**: مفتاح الخدمة (service_role)، كلمة مرور قاعدة البيانات، المفتاح السري للبوابة.

## 4. قبل الإطلاق

1. الإعدادات من اللوحة: اسم المتجر، واتساب (بصيغة 9665xxxxxxxx)، إنستقرام، بيانات التحويل البنكي، الرقم الضريبي، سياسة الاستبدال، الشحن المجاني.
2. مدن الشحن ورسومها الفعلية.
3. المنتجات الحقيقية بصورها ومقاساتها، ثم حذف التجريبية: نفّذ `scripts/clear-demo.sql` في SQL Editor.
4. استبدال `images/logo.svg` بالشعار الرسمي (نفس الاسم) أو تعديل `index.html` و`admin/index.html`.
5. جرّبي طلباً حقيقياً كاملاً من الجوال (تحويل بنكي وعند الاستلام) وأكّديه من اللوحة.

## 5. إعادة البناء من الصفر (إن لزم)

1. مشروع Supabase جديد → نفّذ ملفات `supabase/migrations/` بالترتيب (001 → 004) في SQL Editor.
2. ضع الرابط والمفتاح العام في `js/config.js`، وعدّل رابط المشروع والمفتاح في `.github/workflows/keepalive.yml`.
3. الخطوات 1–4 أعلاه.
