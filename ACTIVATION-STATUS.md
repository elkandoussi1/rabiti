# حالة التفعيل — 12 أكتوبر 2026

مشروع rabiti: wyltsyykfidipnbcdsfx
تم تطبيق rabiti_cloud_stores، وتفعيل RLS وعزل المسودات والصفحات العامة.
config.js يتضمن رابط المشروع والمفتاح العام Publishable.
الفحص الأمني وفحص الأداء لم يُظهرا ملاحظات.
تم تجهيز الكود للنشر على GitHub؛ لم يُختبر التسجيل الفعلي أو إرسال البريد على الموقع.

قبل التجربة، من Authentication → URL Configuration اضبط:
Site URL: https://elkandoussi1.github.io/rabiti/index.html
Redirect URLs: https://elkandoussi1.github.io/rabiti/index.html

ثم ارفع محتويات النسخة إلى جذر المستودع. لا تعد تشغيل schema.sql.
سجّل حسابًا، أكد البريد، أنشئ المتجر ثم انشره.
رابط public.html?store=ahmed مثال، ولا يعمل حتى إنشاء ونشر متجر بهذا الاسم.

للوصول لبيانات الحساب المحلي القديم وتصديرها، افتح index.html?local=1.

تحديث المنتجات المدفوعة: تم تطبيق rabiti_paid_delivery وrabiti_paid_delivery_hardening.
تأكيد الدفع يدوي. الملف أو الرابط خاص، ويُسلّم بعد التفعيل بواسطة الخادم.
راجع SECURITY-STATUS.md لنتائج الاختبار وحدود مشاركة الملفات بعد التسليم.
