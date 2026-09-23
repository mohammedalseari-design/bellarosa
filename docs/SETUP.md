# الإعداد والتشغيل

## ما هو جاهز الآن

- مشروع Supabase «بيلا روزا» (`oxsttfljqbunanmwdzft`، منظمة mulaem، eu-central-1) مُنشأ، والهجرتان `001_init` و`002_place_order_search_path`
  مطبّقتان، والبيانات التجريبية (`scripts/seed-demo.sql`) محمّلة.
- `js/config.js` يحمل رابط المشروع والمفتاح العام.

## 1. أول حساب مدير (مرة واحدة، من لوحة Supabase)

الدخول للوحة الإدارة باسم مستخدم يُحوَّل داخلياً إلى إيميل `username@users.bellarosa.sa` (لا يلزم بريد حقيقي).

1. لوحة Supabase → المشروع «بيلا روزا» → **Authentication → Users → Add user → Create new user**:
   - Email: `bandar@users.bellarosa.sa` (أو أي اسم مستخدم آخر بنفس الصيغة)
   - Password: كلمة مرور قوية (8 خانات فأكثر) — تكتبها أنت ولا تُشارك.
   - فعّل **Auto Confirm User**.
2. **SQL Editor** ونفّذ (غيّر اسم المستخدم والاسم الكامل):
   ```sql
   insert into public.profiles (id, username, fullname, role)
   select id, 'bandar', 'بندر', 'admin' from auth.users where email = 'bandar@users.bellarosa.sa';
   ```
3. افتح `admin/` وادخل باسم المستخدم `bandar` وكلمة المرور.

الموظفات الأخريات بنفس الطريقة مع `role = 'staff'` (لا يعدّلن الإعدادات). حتى تُبنى إدارة الموظفين من اللوحة (المرحلة 3)
هذه هي الطريقة الوحيدة، وحظر موظفة = `update public.profiles set is_blocked = true where username = '...'`.

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

1. مشروع Supabase جديد → نفّذ `supabase/migrations/001_init.sql` ثم `002_place_order_search_path.sql` في SQL Editor.
2. ضع الرابط والمفتاح العام في `js/config.js`، وعدّل رابط المشروع والمفتاح في `.github/workflows/keepalive.yml`.
3. الخطوات 1–4 أعلاه.
