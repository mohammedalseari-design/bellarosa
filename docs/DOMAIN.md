# ربط نطاق خاص بالمتجر (لاحقاً)

المتجر يعمل على `https://mohammedalseari-design.github.io/bellarosa/` والكود يستخدم مسارات نسبية فقط، فالربط لا يحتاج تعديلاً.

## المتاح (فحص GoDaddy، 23 سبتمبر 2026)

- محجوز: `bellarosa.com`, `bellarosa.store`, `bellarosa.sa`, `bellarosa.com.sa` (نطاقات `.sa` تُفحص في nic.sa مباشرة).
- متاح: `bellarosa.shop` (Premium)، `bellarosa.boutique`، `bellaroza.com`، `bellarosaksa.com`، `bellarosa-shop.com`، `bellarosa.co` (Premium).

## الخطوات

1. عند مسجّل النطاق: سجل `CNAME` — الاسم `www` (أو `shop`) — القيمة `mohammedalseari-design.github.io` — TTL 600.
   وللنطاق الجذر (بلا www) سجلات `A` إلى عناوين GitHub Pages: 185.199.108.153، 185.199.109.153، 185.199.110.153، 185.199.111.153.
2. في المستودع: ملف `CNAME` في الجذر يحوي سطراً واحداً بالنطاق (مثل `www.bellarosa.boutique`).
3. GitHub → Settings → Pages → Custom domain → اكتب النطاق → Save → انتظر "DNS check successful" → فعّل **Enforce HTTPS**.
4. بعد الربط حدّث `callback_url` لا يحتاج تعديلاً (يُبنى من `location.origin`)، لكن أضف النطاق الجديد في إعدادات بوابة الدفع إن كانت تقيّد النطاقات.
