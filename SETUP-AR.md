# تفعيل رابطي: Supabase والمدفوعات

هذا الدليل يشرح تشغيل نسخة جديدة من رابطي. الواجهة ملفات ثابتة، والخادم هو
Supabase (Auth + Postgres + Edge Functions).

## 1. مشروع Supabase

أنشئ مشروعًا من [supabase.com/dashboard](https://supabase.com/dashboard).

### قاعدة البيانات

من **SQL Editor** شغّل بالترتيب:

1. `supabase/schema.sql` — الجداول الأساسية (`rabiti_stores`, `rabiti_pages`).
2. `supabase/v2.sql` — الطلبات، الخصومات، العملاء، الإحصاءات، المدفوعات، والتسليم.

`v2.sql` يستبدل دوال النشر والتسليم القديمة ويحذف `rabiti_redeem` و`rabiti_download`
و`rabiti_code_status`. شغّله مرة واحدة فقط. خُذ نسخة احتياطية من المشروع قبل
تشغيله على قاعدة تحتوي بيانات حقيقية.

> لا تشغّل أي مخططات قديمة؛ لم تعد جزءًا من هذا المستودع. الملفان الوحيدان
> المطلوبان هما `supabase/schema.sql` ثم `supabase/v2.sql`.

### المصادقة

من **Authentication → URL Configuration**:

- **Site URL**: `https://elkandoussi1.github.io/rabiti/index.html`
- **Redirect URLs**: أضف الرابط نفسه، وأضف رابط المعاينة المحلي
  `http://localhost:8080/index.html` إن كنت تطور محليًا.

فعّل **Email + Password** وتأكيد البريد. اضبط SMTP قبل فتح التسجيل للجمهور.

### الإعداد العام

انسخ **Project URL** و**Publishable Key** إلى `config.js`:

```js
window.RABITI_CONFIG = {
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
};
```

لا تضع `service_role` أو أي مفتاح سري في `config.js`.

## 2. نشر Edge Functions

يتطلب [Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy youcanpay-tokenize --no-verify-jwt
supabase functions deploy youcanpay-webhook --no-verify-jwt
```

- `youcanpay-tokenize`: يتحقق من رقم الطلب وtoken، ثم يجلب مفاتيح المتجر
  ويحوّلها إلى token دفع قصير العمر. المتصفح لا يرى المفتاح الخاص.
- `youcanpay-webhook`: يتحقق من توقيع `X-YOUCANPAY-SIGNATURE`، ثم يؤكد الطلب
  ويسلّم المنتج مرة واحدة فقط.

`--no-verify-jwt` مقصود: الزبون لا يملك جلسة Supabase، والتحقق يتم عبر token
الطلب أو توقيع المزود. لا تضع مفتاح service role في الواجهة.

## 3. ربط YouCan Pay

1. سجّل في [youcanpay.com](https://youcanpay.com) وأكمل بيانات التاجر.
2. من لوحة YouCan Pay انسخ **Public Key** و**Private Key**.
3. في رابطي ← **المدفوعات** ألصقهما، وفعّل الاتصال.
4. أضف رابط الـ webhook:

   ```text
   https://<project-ref>.supabase.co/functions/v1/youcanpay-webhook
   ```

5. أثناء التجربة استخدم مفاتيح sandbox (`pub_sandbox_...` / `pri_sandbox_...`).

### بطاقات الاختبار

| البطاقة | النتيجة |
| --- | --- |
| `4242 4242 4242 4242` | نجاح |
| `4000 0000 0000 3220` | نجاح مع 3DS |
| `4000 0000 0000 0077` | رفض |

## 4. طرق الدفع اليدوية

تعمل فورًا بدون أي مفاتيح API. من **المدفوعات → إضافة**:

- تحويل بنكي: اسم صاحب الحساب وRIB.
- CashPlus: الاسم أو رقم الهاتف.
- PayPal: البريد أو رابط الدفع.
- طريقة مخصصة: أي تعليمات أخرى.

بعد إنشاء الطلب يرى الزبون التعليمات، ويضغط «أبلغت عن الدفع» ويكتب مرجع
التحويل. تؤكد الدفع من **الطلبات** فيُفتح رابط التسليم.

## 5. تجربة كاملة قبل النشر

1. سجّل حسابًا جديدًا وأكّد البريد.
2. أنشئ متجرًا واختر رابطًا فريدًا.
3. أضف رابطًا ومنتجًا مدفوعًا (رابط تسليم `https://` أو ملف صغير).
4. أضف طريقة دفع يدوية وانشر المتجر.
5. افتح رابط المتجر من نافذة خاصة، وأنشئ طلبًا.
6. أكد الدفع يدويًا، ثم حمّل المنتج من رابط الطلب.
7. جرّب كود خصم، إلغاء طلب، واسترجاعًا.
8. جرّب YouCan Pay في sandbox ثم تحقق من وصول الـ webhook.
9. جرّب تغيير الرابط، إيقاف النشر، وتصدير/استيراد JSON.

## 6. حدود معروفة

- لا تُرسل إيصالات بريدية تلقائيًا بعد الدفع؛ رابط الطلب يظهر للزبون بعد الإنشاء.
- الاسترجاع يُعلّم الطلب ويوقف التحميل، لكنه لا يعكس العملية تلقائيًا لدى YouCan Pay.
- لا يوجد DRM: بعد التسليم يمكن للزبون حفظ الملف أو مشاركة الرابط.
- الملفات الصغيرة تُخزَّن داخل مسودة JSON (حد 8 MB للمسودة). استخدم رابطًا
  خارجيًا للملفات الكبيرة.
- لا توجد مزامنة بين جهازين أثناء التحرير؛ الحفظ يكتشف التعارض ويطلب إعادة التحميل.

## 7. الملفات

- `config.js`: الإعدادات العامة فقط.
- `app.js` و`views.js` و`api.js` و`ui.js`: لوحة التحكم.
- `public.html` و`public.js` و`store.css`: المتجر العام.
- `supabase/schema.sql` و`supabase/v2.sql`: قاعدة البيانات.
- `supabase/functions/`: تكامل YouCan Pay.
- `tests/`: اختبارات محلية؛ راجع `TESTING.md`.

المراجع الرسمية:

- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://docs.youcan.shop/youcan-pay
