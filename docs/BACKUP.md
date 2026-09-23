# النسخ الاحتياطي الليلي

الخطة المجانية في Supabase بلا نسخ احتياطي، والطلبات سجلات مالية. `.github/workflows/backup.yml` يأخذ نسخة `pg_dump`
كل ليلة ويرفعها كـ artifact في GitHub تبقى **تسعين يوماً**. هذا حل مؤقت مناسب لبداية المتجر، لا بديل عن Supabase Pro
(استرجاع لحظي) عندما تصبح المبيعات فعلية.

## التفعيل (مرة واحدة)

1. لوحة Supabase → المشروع «بيلا روزا» → **Project Settings → Database → Connection string → URI**، اختر **Session pooler**
   وانسخ الرابط، وضع كلمة مرور قاعدة البيانات مكان `[YOUR-PASSWORD]`.
2. GitHub → المستودع `bellarosa` → **Settings → Secrets and variables → Actions → New repository secret**:
   الاسم `SUPABASE_DB_URL` والقيمة الرابط كاملاً.
3. Actions → **backup** → **Run workflow** للتأكد. بدون السر يُتخطى التشغيل الليلي بتحذير (لا فشل ولا رسائل بريد) ولا يرفع
   ملفاً فارغاً؛ بعد إضافة السر يعمل من الليلة التالية بلا أي تعديل.

كلمة مرور قاعدة البيانات تُعرض/تُعاد من **Project Settings → Database → Reset database password** إن لم تكن محفوظة.
لا تُكتب في المستودع ولا تُرسل في المحادثات.

## تنزيل نسخة

Actions → backup → آخر تشغيل ناجح → Artifacts → `bellarosa-db-backup`.

## الاستعادة في مشروع جديد

```
gunzip bellarosa-2026-09-23.sql.gz
psql "<رابط المشروع الجديد>" -f bellarosa-2026-09-23.sql
```

الصور في مخزن Supabase Storage لا تدخل في هذه النسخة؛ احتفظي بأصول الصور محلياً.
