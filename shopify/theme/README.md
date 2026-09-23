# ثيم بيلا روزا العربي (Horizon)

هذه نُسخ حرفية من ملفات JSON الأربعة في الثيم المنشور «بيلا روزا — الثيم العربي»
(`gid://shopify/OnlineStoreTheme/192373424409`، 24 سبتمبر 2026)، رُفعت عبر `themeFilesUpsert`.
باقي ملفات الثيم (liquid/css/js) هي ملفات Horizon الأصلية بلا تعديل.

| الملف | ماذا يضبط |
|---|---|
| `config/settings_data.json` | الخطوط (Almarai للنصوص، Amiri للعناوين)، اللوحة اللونية (عاجي `#FBF7F4`، برقوقي `#5B2A3C`، وردي `#E8D3D7`)، عرض الصفحة، البطاقات |
| `sections/header-group.json` | شريط الإعلانات الثلاثي + الهيدر (الشعار والقائمة الرئيسية) |
| `sections/footer-group.json` | التذييل: نبذة، المجموعات، الصفحات، اشتراك بريدي، الحقوق |
| `templates/index.json` | الصفحة الرئيسية بأقسامها التسعة (غلاف → شريط ثقة → الفئات → المختارات → قصتنا → البيبي → لماذا نحن → أسئلة شائعة → اشتراك) |

## التعديل

1. عدّل الملف هنا (المفاتيح والقيم تتبع مخطط Horizon: `type_preset`، `alignment`، المدى ≤ 50 لـ `corner_radius`، إلخ).
2. الـ API يرفض الكتابة على الثيم المنشور: انسخه (`themeDuplicate`) ثم ارفع الملف على النسخة بـ `themeFilesUpsert`،
   أو الصقه مباشرة من Online Store → Themes → ⋯ → Edit code.
3. عاين النسخة (`?preview_theme_id=<id>`) ثم انشرها من Online Store → Themes.

صورة الغلاف الحالية في `shopify/media/hero-bg.jpg` (مرفوعة في Files باسم `bellarosa-hero-bg.jpg` ومشار إليها بـ
`shopify://shop_images/bellarosa-hero-bg.jpg`). الشعار وصور الفئات تُرفع من Customize.
