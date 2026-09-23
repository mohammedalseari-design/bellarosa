# هوية بيلا روزا — مصادر التصاميم

كل صور الهوية ورسومات المنتجات وتصاميم الإطلاق تُولَّد من هذه السكربتات (HTML/SVG يُرسم بمتصفح Chromium عبر Playwright)،
فأي تعديل في لون أو نص يُعاد توليده بأمر واحد بدل برامج التصميم.

| السكربت | يولّد |
|---|---|
| `rose.py` | الوردة الخطية (رمز الشعار) والوردة الخماسية الزخرفية |
| `make_assets.py` | الشعار الكامل (عادي وأبيض)، صورة المشاركة `og-share.jpg`، أغلفة الفئات الأربع |
| `make_header.py` | شعار الهيدر بخط أثقل للوردة حتى يبقى واضحاً بالأحجام الصغيرة |
| `products_illus.py` + `make_products.py` | رسومات المنتجات الثمانية (1200×1500) |
| `kit.py` | منشورات إنستقرام، الستوري، أغلفة الهايلايت، صورة الحساب (`../marketing/instagram/`) |

## التشغيل

```
pip install playwright pillow
python -m playwright install chromium
mkdir fonts   # Amiri, Almarai, Marcellus, ... من github.com/google/fonts (ofl/)
python make_assets.py && python make_header.py && python make_products.py && python kit.py
```

المخرجات في `out/` و`kit/`، والنسخ المعتمدة منسوخة إلى `../shopify/media/` و`../marketing/instagram/`.
الألوان: برقوقي `#5B2A3C` · موف `#9A5F70` · عاجي `#FBF7F4` · وردي `#F3DCE0`.
