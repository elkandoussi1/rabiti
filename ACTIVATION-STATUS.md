# حالة التفعيل — 10 نوفمبر 2026

## الحالة: الخادم جاهز ومُختبر

- مشروع Supabase: `bmiyixmiuminepmnmyjr` (منطقة الاتحاد الأوروبي).
- `supabase/schema.sql` ثم `supabase/v2.sql` طُبّقا بنجاح على المشروع الحقيقي.
- Auth: تم ضبط **Site URL** و**3 Redirect URLs**، وتأكيد البريد **مُعطّل مؤقتاً**
  لأن SMTP الحقيقي لم يُضبط بعد.
- Edge Functions منشورتان بـ `--no-verify-jwt`:
  `youcanpay-tokenize` و`youcanpay-webhook`.
- دُمج الفرع `feat/rabiti-v2` في `main` ونُشر على GitHub Pages في 10 نوفمبر 2026:
  <https://elkandoussi1.github.io/rabiti/> — الإصدار `2026.11.9.1` (Rabiti 2.1).

## ما تم التحقق منه على المشروع الحقيقي

| الاختبار | النتيجة |
|---|---|
| إنشاء حساب جديد | يعمل ويُدخل مباشرة (بلا انتظار بريد) |
| إنشاء متجر، حفظ، نشر | `revision` يتزايد، والنشر يُنتج صفحة عامة |
| تسريب رابط التسليم في النسخة العامة | لا يظهر `src` إطلاقاً |
| طلب مدفوع + كوبون 10% | الخصم والمجموع صحيحان |
| التحميل قبل الدفع | محجوب (`null`) |
| تأكيد الدفع اليدوي | `pending` → `delivered` ثم يُسمح بالتحميل |
| إعادة إرسال حدث webhook | لا تسليم مزدوج (idempotent) |
| التلاعب بالمبلغ في webhook | `400 payment_mismatch` ويبقى الطلب `pending` |
| توقيع webhook خاطئ | `401 invalid_signature` |
| عدم تطابق sandbox/live | `400 sandbox_mismatch` |
| مفاتيح YouCan Pay | تُحفظ، والمفتاح الخاص لا يُعاد للواجهة أبداً |
| نشر منتج مدفوع بلا مفاتيح YouCan Pay | يُرفض بـ `PAYMENT_NOT_CONFIGURED` |
| حذف المتجر | يحذف الطلبات والكوبونات والصفحة معه |

## ما تبقّى قبل الإنتاج

1. إدخال مفاتيح YouCan Pay (Sandbox أولاً) من لوحة تحكم المتجر.
2. إضافة رابط الـ webhook في لوحة YouCan Pay:
   `https://bmiyixmiuminepmnmyjr.supabase.co/functions/v1/youcanpay-webhook`
   مع إضافة `elkandoussi1.github.io` و`localhost:8080` إلى الـ allowed hosts.
3. ضبط SMTP حقيقي (Resend أو Brevo) ثم إعادة تفعيل تأكيد البريد.
4. تجربة دفع Sandbox كاملة ببطاقة اختبار من المتصفح.
5. حذف مستخدمي الاختبار من `Authentication → Users` وإلغاء Access Token المؤقت.

## ما لم يُختبر بعد

- YouCan Pay بمفاتيح حقيقية (sandbox أو live).
- إرسال بريد فعلي (تأكيد أو استرجاع كلمة المرور).
- تثبيت PWA على جهاز حقيقي.
- المتصفحات القديمة.
