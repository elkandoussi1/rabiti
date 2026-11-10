<p align="center"><img src="assets/rabiti-banner.svg" alt="Rabiti — One page. Your whole world." width="100%"></p>

<h1 align="center">رابطي · Rabiti</h1>
<p align="center">صفحة روابط، متجر منتجات رقمية، ولوحة تحكم واحدة.</p>
<p align="center"><a href="https://elkandoussi1.github.io/rabiti/">افتح التطبيق</a> · <a href="SETUP-AR.md">دليل الإعداد</a> · <a href="AUTOMATIC-PAYMENTS.md">دليل المدفوعات</a> · <a href="CHANGELOG.md">التحديثات</a></p>
<p align="center"><a href="https://github.com/elkandoussi1/rabiti/actions/workflows/ci.yml"><img src="https://github.com/elkandoussi1/rabiti/actions/workflows/ci.yml/badge.svg" alt="Rabiti checks"></a></p>

## ما هو رابطي؟

تطبيق ويب عربي (RTL) لبناء صفحة شخصية أو متجر رقمي كامل. تدير الروابط والمنتجات
والصور والأسعار من لوحة تحكم حديثة، ثم تنشر نسخة عامة على رابط ثابت. يعمل على
الهاتف والحاسوب، ويمكن تثبيته كتطبيق PWA.

## المميزات

| الميزة | الحالة |
| --- | --- |
| حسابات سحابية وتأكيد البريد واسترجاع كلمة المرور | Supabase Auth |
| مسودة خاصة، حفظ تلقائي، ونشر منفصل | متاح |
| روابط ومنتجات (مدفوع، رابط مجاني، ملف مجاني، عرض فقط) | متاح |
| طلبات حقيقية مع رقم طلب ورابط متابعة خاص | متاح |
| دفع بالبطاقة عبر YouCan Pay | يتطلب مفاتيح التاجر وEdge Functions |
| تحويل بنكي، CashPlus، PayPal، أو رابط دفع مخصص | متاح بدون إعداد API |
| أكواد خصم، عملاء، تحليلات، تصدير CSV | متاح |
| تسليم رقمي محمي بعد تأكيد الدفع | متاح |
| تصدير واستيراد مسودة JSON | متاح |
| تثبيت PWA وتحديث آمن مع حفظ المسودة | متاح |

## طرق الدفع

### YouCan Pay (بطاقات وCashPlus)

1. أنشئ حساب تاجر في [YouCan Pay](https://youcanpay.com) وأكمل التحقق.
2. من لوحة رابطي ← «المدفوعات»، ألصق المفتاح العام والخاص.
3. انشر Edge Functions من مجلد `supabase/functions` (راجع [دليل المدفوعات](AUTOMATIC-PAYMENTS.md)).
4. أضف رابط الـ webhook في لوحة YouCan Pay.
5. استخدم مفاتيح sandbox أثناء التجربة، ثم مفاتيح live عند الجاهزية.

المفتاح الخاص لا يصل إلى المتصفح: يُخزَّن في جدول محمي، ولا تستخدمه إلا Edge
Function عبر service role. واجهة الزبون تحصل على token مؤقت فقط.

### الطرق اليدوية (بدون إعداد)

أضف تحويلًا بنكيًا أو CashPlus أو PayPal أو طريقة مخصصة من «المدفوعات». ينشئ
الزبون الطلب، تظهر له تعليمات الدفع، ثم يضغط «أبلغت عن الدفع» ويكتب مرجع
التحويل. تؤكد أنت الدفع من «الطلبات» فيُفتح رابط التسليم فورًا.

## التشغيل والتطوير

الواجهة ملفات ثابتة؛ لا تحتاج إلى build. شغّل خادمًا محليًا:

```sh
python -m http.server 8080
```

افتح `http://localhost:8080/` للوحة التحكم، و`public.html?store=<slug>` للمتجر.
إعداد Supabase في `config.js` يستخدم عنوان المشروع والمفتاح العام فقط.

قاعدة البيانات:

1. مشروع Supabase جديد.
2. شغّل `supabase/schema.sql` مرة واحدة.
3. شغّل `supabase/v2.sql` بعده مرة واحدة.
4. لا تشغّل مخططات قديمة أو ملفات هجرة محذوفة.

التفاصيل الكاملة في [SETUP-AR.md](SETUP-AR.md).

## الاختبارات

```sh
npm ci
npm test
```

تشمل الاختبارات مخطط PostgreSQL عبر PGlite، منطق المسودات والمنتجات، وثبات
ملفات الواجهة. راجع [TESTING.md](TESTING.md) للحدود وما لم يُختبر.

## بنية المشروع

| المسار | المسؤولية |
| --- | --- |
| `index.html` و`app.js` | هيكل لوحة التحكم، المصادقة، التوجيه، والإجراءات |
| `views.js` | صفحات اللوحة: النظرة العامة، المتجر، المنتجات، الطلبات… |
| `api.js` | طبقة Supabase: المسودات، الطلبات، المدفوعات، الإحصاءات |
| `ui.js` و`app.css` | مكونات الواجهة ونظام التصميم |
| `public.html` و`public.js` و`store.css` | المتجر العام، السلة، الدفع، ومتابعة الطلب |
| `supabase/schema.sql` و`supabase/v2.sql` | الجداول، الصلاحيات، النشر، الطلبات، والتسليم |
| `supabase/functions/` | Edge Functions لتجزئة YouCan Pay واستقبال webhook |
| `sw.js` و`app-update.js` و`release.json` | PWA والتخزين المؤقت وفحص الإصدار |
| `tests/` | اختبارات PGlite وNode وفحص الملفات الثابتة |

## الأمان

- RLS تعزل كل متجر عن الآخر، والمسودة خاصة حتى النشر.
- النشر يبني نسخة عامة من حقول محددة فقط؛ روابط التسليم والملفات المدفوعة لا تظهر.
- رقم الطلب + token عشوائي 64 حرفًا هما مفتاح متابعة الطلب والتحميل.
- webhook يتحقق من توقيع HMAC-SHA256 على الجسم الخام.
- لا تضع `service_role` أو المفتاح الخاص في `config.js` أو أي ملف عام.

راجع [SECURITY-STATUS.md](SECURITY-STATUS.md) و[TESTING.md](TESTING.md)،
و[CONTRIBUTING.md](CONTRIBUTING.md) للمساهمة، و[THIRD-PARTY.txt](THIRD-PARTY.txt).

طوّره [أحمد القندوسي](https://github.com/elkandoussi1) · المغرب.
