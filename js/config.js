// إعدادات الاتصال بـ Supabase — مشروع «بيلا روزا» (منظمة mulaem، منطقة eu-central-1).
// المفتاح هنا هو المفتاح العام (publishable) وهو آمن للنشر: الحماية الفعلية في صلاحيات قاعدة البيانات (RLS).
// لا تضع هنا مفتاح الخدمة (service_role / secret) أبداً.
window.BELLAROSA_CONFIG = {
    SUPABASE_URL: 'https://oxsttfljqbunanmwdzft.supabase.co',
    SUPABASE_KEY: 'sb_publishable_uajb7fCr4OlcHYz9DY-tUw_2_BlVQx-',
    AUTH_EMAIL_DOMAIN: 'users.bellarosa.sa',
    // بعد الانتقال إلى Shopify: ضع رابط المتجر هنا (مثل 'https://bellarosa.myshopify.com') فتتحول كل روابط
    // الموقع القديم إليه فوراً. فارغ = الموقع الحالي يعمل كالمعتاد. (docs/TASK_SHOPIFY.md)
    SHOP_REDIRECT: ''
};
