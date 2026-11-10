# تجهيز رابطي: Supabase وAccess Token وYouCan Pay Sandbox

هذا الدليل يشرح من الصفر تشغيل نسخة رابطي على Supabase، ثم ربط YouCan Pay
بوضع Sandbox وتجربة الدفع كاملًا. الواجهة ملفات ثابتة على GitHub Pages،
والخادم هو Supabase (Auth + Postgres + Edge Functions).

## ما ستحتاجه

- حساب Supabase.
- Node.js 20 أو أحدث، وGit.
- حساب YouCan Pay.
- 30–60 دقيقة.

> إذا كنت ستستخدم مشروع Supabase الموجود في `config.js`، تخطَّ الخطوة 1.1
> وابدأ من 1.2. إذا أنشأت مشروعًا جديدًا، حدّث `config.js` في 1.4.

---

## 1. تجهيز Supabase

### 1.1 إنشاء المشروع

1. افتح <https://supabase.com/dashboard> وسجّل الدخول.
2. اضغط **New project**.
3. اختر المؤسسة (Organization)، ثم املأ:
   - **Name**: `rabiti` أو أي اسم واضح.
   - **Database Password**: كلمة مرور قوية. احفظها في مدير كلمات المرور؛
     ستحتاجها عند `supabase link`، ولا تظهر مرة أخرى.
   - **Region**: أقرب منطقة للمغرب، مثل **West EU (Paris)**. لا تختار منطقة
     بعيدة؛ تؤثر في سرعة لوحة التحكم والدفع.
   - **Plan**: Free تكفي للتجربة.
4. اضغط **Create new project** وانتظر دقيقة أو دقيقتين حتى يجهز.

بعد الإنشاء، مشروعك له **Project ref** من 20 حرفًا. تجده في:

- رابط اللوحة: `https://supabase.com/dashboard/project/<project-ref>`
- **Project Settings → General → Reference ID**

**تنبيهات مهمة:**

- مشروع Free يتوقف مؤقتًا بعد حوالي أسبوع بدون نشاط. إذا توقف، افتحه من
  اللوحة واضغط **Restore**.
- لا تشارك كلمة مرور قاعدة البيانات ولا المفتاح السري (`sb_secret_...`).
- `config.js` يحتاج **Project URL** و**Publishable Key** فقط.

### 1.2 تشغيل مخطط قاعدة البيانات

من **SQL Editor** في لوحة Supabase، شغّل الملفين بالترتيب:

1. افتح `supabase/schema.sql` من المستودع، انسخ كامل محتواه، الصقه في
   **SQL Editor**، واضغط **Run**. يجب أن ينتهي بدون أخطاء.
2. افتح `supabase/v2.sql`، انسخ كامل محتواه، الصقه، واضغط **Run**.

`v2.sql` يضيف الطلبات والخصومات والعملاء والإحصاءات والمدفوعات والتسليم،
ويستبدل دوال النشر والتسليم القديمة. شغّله **مرة واحدة** فقط. إذا كانت القاعدة
تحتوي بيانات حقيقية، خُذ نسخة احتياطية من **Database → Backups** قبل تشغيله.

للتحقق، شغّل في **SQL Editor**:

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name like 'rabiti_%'
order by 1;
```

يجب أن ترى جداول مثل `rabiti_stores` و`rabiti_pages` و`rabiti_orders`
و`rabiti_discounts` و`rabiti_payment_secrets` و`rabiti_order_events`.

وتحقق من الدوال:

```sql
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'rabiti_%'
order by 1;
```

### 1.3 إعدادات المصادقة

#### روابط الموقع

من **Authentication → URL Configuration**:

- **Site URL**:
  `https://elkandoussi1.github.io/rabiti/index.html`
- **Redirect URLs**، أضف:
  - `https://elkandoussi1.github.io/rabiti/index.html`
  - `http://localhost:8080/index.html` للتجربة المحلية.

إذا أضفت نطاقًا خاصًا لاحقًا، أضف رابطه بنفس الصيغة. التطبيق يستخدم
`new URL('index.html', location.href).href`، لذلك يجب أن يطابق الرابط
المسجّل هنا الصفحة التي يفتحها المستخدم بعد تأكيد البريد أو استرجاع كلمة المرور.

#### تفعيل البريد وكلمة المرور

من **Authentication → Providers → Email**:

- فعّل **Enable Email provider**.
- أبقِ **Confirm email** مفعّلًا في الإنتاج.
- يمكنك إيقافه مؤقتًا أثناء التجربة المحلية لتسريع إنشاء الحسابات، لكن أعد
  تفعيله قبل فتح التسجيل للجمهور.

#### SMTP

في **Authentication → SMTP** اضبط مزود بريد حقيقيًا قبل فتح التسجيل للناس.
خادم Supabase الافتراضي:

- يرسل فقط إلى أعضاء فريق المشروع.
- محدود بحوالي رسالتين في الساعة.
- غير مخصص للإنتاج.

أي مزود SMTP يعمل، مثل Resend أو Brevo أو Postmark أو AWS SES. الحقول
المطلوبة عادة:

| الحقل | مثال |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` أو اسم المستخدم من المزود |
| Password | مفتاح SMTP من المزود |
| Sender email | `no-reply@yourdomain.com` |
| Sender name | `رابطي` |

بعد الحفظ، عدّل **Authentication → Rate Limits** إذا كنت تتوقع تسجيلات كثيرة.
الحد الافتراضي بعد SMTP المخصص حوالي 30 رسالة في الساعة.

#### قوالب البريد

من **Authentication → Emails** راجع قوالب:

- Confirm signup
- Reset password
- Magic link

اترك `{{ .ConfirmationURL }}` موجودًا في القالب؛ فهو رابط التأكيد أو الاسترجاع.
يمكنك تعريب النصوص مع الحفاظ على المتغير.

### 1.4 مفاتيح API و`config.js`

من **Project Settings → API Keys** (أو من نافذة **Connect**) انسخ:

- **Project URL**: `https://<project-ref>.supabase.co`
- **Publishable key**: يبدأ بـ `sb_publishable_...`

افتح `config.js` وحدّث:

```js
window.RABITI_CONFIG = {
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
};
```

**لا تضع** `sb_secret_...` أو `service_role` أو المفتاح الخاص لـYouCan Pay في
`config.js`؛ هذه ملفات تصل إلى المتصفح. Edge Functions تحصل على المفتاح السري
تلقائيًا من بيئة Supabase.

إذا غيرت `config.js`، ارفع التغيير إلى الفرع الذي تنشر منه GitHub Pages.
الموقع الحالي يخدم `main`، والفرع `feat/rabiti-v2` لا يُنشر تلقائيًا.

### 1.5 تشغيل محلي

من مجلد المشروع:

```powershell
python -m http.server 8080
```

أو أي خادم ثابت آخر. افتح:

- لوحة التحكم: `http://localhost:8080/`
- المتجر: `http://localhost:8080/public.html?store=<slug>`

لا تفتح `index.html` مباشرة عبر `file://`؛ المصادقة وSupabase يحتاجان
`http://` أو `https://`.

---

## 2. Supabase Access Token وCLI

Access Token هو مفتاح دخول لـ**إدارة مشروع Supabase** عبر CLI أو Management
API. ليس كلمة مرور قاعدة البيانات، وليس Publishable Key، ولا يُستخدم في
المتصفح.

### 2.1 إنشاء التوكن

1. افتح <https://supabase.com/dashboard/account/tokens>.
2. اضغط **Generate new token**.
3. اكتب اسمًا واضحًا، مثل `rabiti-cli`.
4. اختر **نطاقًا محددًا** (Scoped) بدل الوصول الكامل:
   - **Organization**: مؤسستك.
   - **Project**: مشروع رابطي.
   - الصلاحيات:
     - **Project Settings**: Read
     - **API Keys**: Read
     - **API Key Secrets**: Read
     - **Edge Functions**: Read and Write
     - **Projects (account-wide)**: Read (اختياري، لـ`projects list`)
5. اضغط **Generate token** وانسخه فورًا. لن يظهر مرة أخرى.

التوكن المقيّد يبدأ عادة بـ`sbp_fc...`. التوكن القديم كامل الوصول يظهر بشارة
**Legacy** ويبدأ بـ`sbp_...`؛ تجنبه إلا للضرورة.

**لماذا هذه الصلاحيات؟**

- `supabase link` يحتاج **Project Settings** و**API Keys** و**API Key Secrets**
  بصلاحية قراءة.
- نشر Edge Functions يحتاج **Edge Functions** قراءة وكتابة.
- `supabase projects list` يحتاج **Projects (account-wide)** قراءة.

### 2.2 استخدام التوكن على Windows/PowerShell

الطريقة الآمنة هي متغير بيئة للجلسة الحالية:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_fc_..."
npx.cmd supabase@latest projects list
```

أو احفظه عبر CLI:

```powershell
npx.cmd supabase@latest login --token "sbp_fc_..."
```

ملاحظات:

- متغير `SUPABASE_ACCESS_TOKEN` له الأولوية على التوكن المحفوظ.
- لا تضع التوكن في `config.js` ولا في Git ولا في محادثة عامة.
- إذا انتهى أو تسرب، احذفه من صفحة Access Tokens وأنشئ بديلًا.
- على PowerShell استخدم `npx.cmd` وليس `npx` إذا كان التنفيذ محظورًا.

للتحقق:

```powershell
npx.cmd supabase@latest whoami
npx.cmd supabase@latest projects list
```

### 2.3 ربط المشروع

من جذر المستودع:

```powershell
cd C:\Users\accent\Documents\rabiti
npx.cmd supabase@latest link <project-ref>
```

سيسألك عن **Database Password**، وهي كلمة المرور التي وضعتها عند إنشاء
المشروع، وليست Access Token. إذا نسيتها، أعد تعيينها من
**Project Settings → Database → Reset database password**.

إذا نجح الربط، ستجد ملف `supabase/.temp/project-ref`. لا ترفعه إلى Git.

### 2.4 نشر Edge Functions

```powershell
npx.cmd supabase@latest functions deploy youcanpay-tokenize --no-verify-jwt
npx.cmd supabase@latest functions deploy youcanpay-webhook --no-verify-jwt
```

`--no-verify-jwt` مقصود: الزبون لا يملك جلسة Supabase. الدالتان تحميان نفسيهما
بطريقة أخرى:

- `youcanpay-tokenize`: تتحقق من رقم الطلب وtoken الطلب (64 حرفًا) قبل جلب
  مفاتيح المتجر.
- `youcanpay-webhook`: تتحقق من توقيع `X-YOUCANPAY-SIGNATURE` قبل تأكيد الدفع.

**لا تحتاج إلى إضافة أسرار يدويًا.** Supabase يحقن تلقائيًا:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEYS` (المفضّل، قاموس JSON)
- `SUPABASE_SERVICE_ROLE_KEY` (المفتاح القديم، للتوافق)

الدالتان تفضلان `SUPABASE_SECRET_KEYS` وتعودان إلى المفتاح القديم عند الحاجة.

### 2.5 التحقق من النشر

من **Edge Functions** في لوحة Supabase:

- يجب أن تظهر `youcanpay-tokenize` و`youcanpay-webhook` بحالة نشطة.
- افتح **Logs** لكل دالة وتأكد من عدم وجود أخطاء بدء تشغيل.
- رابط الـwebhook سيكون:

```text
https://<project-ref>.supabase.co/functions/v1/youcanpay-webhook
```

يمكنك اختبار أن الدالة منشورة بهذا الأمر (سيعيد خطأً متوقعًا لأن الطلب غير
موقّع، لكنه يثبت أن الدالة تعمل):

```powershell
curl.exe -i -X POST "https://<project-ref>.supabase.co/functions/v1/youcanpay-webhook" `
  -H "Content-Type: application/json" `
  -d "{}"
```

إذا رأيت `invalid_order` أو `invalid_signature` فالدالة وصلت إلى منطقها، وليس
إلى خطأ 404.

### 2.6 أخطاء شائعة في CLI

| الخطأ | السبب والحل |
| --- | --- |
| `Access token not provided` | لم تضبط `SUPABASE_ACCESS_TOKEN` ولم تسجل الدخول. |
| `403` عند `link` | التوكن ينقصه **Project Settings** أو **API Keys** أو **API Key Secrets**. |
| `403` عند نشر الدالة | التوكن ينقصه **Edge Functions** قراءة وكتابة. |
| `failed to connect to database` | كلمة مرور قاعدة البيانات خاطئة؛ أعد تعيينها. |
| `supabase: command not found` | استخدم `npx.cmd supabase@latest` بدل `supabase`. |
| `Docker is not running` | لا تحتاجه للنشر عن بعد؛ يظهر فقط في أوامر `db` المحلية. |

---

## 3. YouCan Pay Sandbox

### 3.1 إنشاء حساب التاجر

1. افتح <https://youcanpay.com/register/>.
2. أنشئ حسابًا بالبريد الإلكتروني، وأكّد الرسالة.
3. أكمل بيانات التاجر:
   - الاسم القانوني والنشاط.
   - الهاتف والدولة (المغرب).
   - معلومات الهوية إذا طلبتها المنصة.
   - الحساب البنكي/RIB لاستلام التحويلات.
4. انتظر التحقق. غالبًا تحصل على مفاتيح **Sandbox** قبل اكتمال التحقق
   الكامل، بينما مفاتيح **Live** تحتاج الموافقة.

### 3.2 الحصول على مفاتيح Sandbox

من لوحة YouCan Pay:

1. افتح **Settings** ثم **API / Developers / API Keys** (قد يختلف الاسم قليلًا
   حسب نسخة اللوحة).
2. ابحث عن قسم **Sandbox**.
3. انسخ:
   - **Public Key**: يبدأ بـ`pub_sandbox_...`
   - **Private Key**: يبدأ بـ`pri_sandbox_...`

**لا تخلط بين Sandbox وLive:**

| النوع | Public | Private | Tokenize URL |
| --- | --- | --- | --- |
| Sandbox | `pub_sandbox_...` | `pri_sandbox_...` | `https://youcanpay.com/sandbox/api/tokenize` |
| Live | `pub_...` | `pri_...` | `https://youcanpay.com/api/tokenize` |

المفتاح الخاص يبقى سريًا. لا تضعه في `config.js` ولا في أي صفحة عامة. رابطي
يخزنه في جدول محمي، ولا تعيده أي دالة عامة.

### 3.3 السماح بنطاقات المتجر

من إعدادات الدفع في YouCan Pay، ابحث عن **Allowed hosts** أو **Authorized
domains** وأضف:

- `localhost:8080` للتجربة المحلية.
- `elkandoussi1.github.io` لنسخة GitHub Pages.

إذا كان الحقل يطلب مخططًا كاملًا، استخدم:

- `http://localhost:8080`
- `https://elkandoussi1.github.io`

بدون هذه الخطوة قد يفشل `mount()` برسالة `host_not_allowed`.

### 3.4 ربط المفاتيح في رابطي

1. سجّل الدخول إلى لوحة رابطي.
2. افتح **المدفوعات**.
3. في بطاقة **YouCan Pay**:
   - الصق **Public Key**.
   - الصق **Private Key**.
   - فعّل **وضع التجربة (Sandbox)**. هذه الخطوة ضرورية مع مفاتيح
     `pub_sandbox_` / `pri_sandbox_`؛ بدونها سيحاول الخادم الاتصال بـLive
     ويرفض المفتاح.
   - فعّل **تفعيل الدفع بالبطاقة**.
4. اضغط **حفظ الاتصال**.
5. انشر المتجر من زر **نشر** حتى تظهر طريقة الدفع للزبائن.

للتحقق من الحفظ، أعد تحميل صفحة **المدفوعات**؛ يجب أن تظهر الحالة **مفعّل**.
المفتاح الخاص لن يظهر مرة أخرى، وهذا طبيعي.

### 3.5 إعداد الـWebhook

في لوحة YouCan Pay، افتح **Webhooks** (أو **Developers → Webhooks**) وأضف:

```text
https://<project-ref>.supabase.co/functions/v1/youcanpay-webhook
```

الأحداث:

- `transaction.paid` — أساسي، به يُؤكد الطلب ويُفتح التسليم.
- `transaction.failed` — اختياري، الدالة تتجاهله بأمان.
- `transaction.refunded` — اختياري، الدالة تتجاهله بأمان.

ملاحظات:

- التوقيع يستخدم **المفتاح الخاص نفسه**؛ لا يوجد «webhook secret» منفصل.
  إذا غيّرت المفتاح الخاص في YouCan Pay، حدّثه في رابطي فورًا وإلا ستفشل
  التوقيعات.
- Webhooks المنشأة عبر API تكون **Live** دائمًا حسب توثيق YouCan Pay. إذا كانت
  لوحتك تتيح Webhook تجريبيًا في Sandbox فاستخدمه؛ وإلا اختبر التوقيع يدويًا
  أو انتقل إلى Live بمبلغ صغير بعد اكتمال التحقق.
- الدالة تتحقق من أن حدث الـwebhook يطابق وضع المتجر (Sandbox أو Live). لا
  تخلط مفاتيح Sandbox مع وضع Live.

### 3.6 بطاقات الاختبار

استخدم أي تاريخ انتهاء مستقبلي بصيغة `MM/YY` وأي CVV. النتيجة تعتمد على رقم
البطاقة فقط. الأرقام الأخرى تعيد `card_not_accepted`.

| البطاقة | النتيجة |
| --- | --- |
| `4242 4242 4242 4242` | نجاح بدون 3DS |
| `4000 0000 0000 3220` | يتطلب 3DS، وينجح بعد الموافقة |
| `4000 0000 0000 0077` | رفض بسبب رصيد غير كافٍ، بدون 3DS |
| `4000 0084 0000 1629` | يتطلب 3DS، ويفشل بعد التحدي |

لتجربة فشل 3DS: استخدم بطاقة 3DS وارفض التحدي في النافذة. لتجربة نجاح 3DS:
استخدم البطاقة نفسها ووافق على التحدي.

### 3.7 اختبار الدفع كاملًا

1. افتح لوحة رابطي، أنشئ منتجًا مدفوعًا، وانشره.
2. افتح رابط المتجر في نافذة خاصة (بدون جلسة سابقة):
   `https://elkandoussi1.github.io/rabiti/public.html?store=<slug>`
   أو محليًا:
   `http://localhost:8080/public.html?store=<slug>`
3. أضف المنتج إلى السلة، أدخل بيانات الزبون، واختر **الدفع بالبطاقة**.
4. أدخل بطاقة `4242 4242 4242 4242`، أي تاريخ مستقبلي، وأي CVV.
5. بعد النجاح، انتظر ثوانٍ. يجب أن يتحول الطلب إلى **مدفوع/مسلّم**، ويظهر زر
   التحميل في صفحة الطلب.
6. من لوحة رابطي ← **الطلبات**، تأكد من ظهور الطلب وحالته.
7. من **Edge Functions → youcanpay-webhook → Logs**، تأكد من استجابة 200 ومن
   عدم وجود `invalid_signature` أو `payment_mismatch`.
8. من لوحة YouCan Pay ← **Webhook History**، تأكد من محاولة التسليم ورمز
   الاستجابة.

إذا نجح الدفع لكن الطلب بقي معلقًا:

- تأكد من أن Webhook URL صحيح ويبدأ بـ`https://`.
- تأكد من أن المفتاح الخاص في رابطي هو نفسه الذي وقع به YouCan Pay الحدث.
- تأكد من تطابق وضع Sandbox/Live.
- راجع سجلات الدالة؛ `order_not_found` يعني أن رقم الطلب المرسل لا يطابق أي
  طلب في قاعدة البيانات.
- تأكد من أن الطلب لم يُلغَ قبل الدفع.

### 3.8 التحقق اليدوي من التوقيع (اختياري)

إذا أردت التأكد من أن الدالة تستقبل توقيعًا صحيحًا دون انتظار Webhook حقيقي،
أنشئ طلبًا تجريبيًا واحفظ رقمه (`RB-...`) والمبلغ، ثم استخدم سكربت Node من
جذر المشروع. السكربت يحتاج `fetch` الموجود في Node 18+.

```js
// test-webhook.mjs — لا ترفعه إلى Git
const order = 'RB-XXXXXXXXXX';
const amount = '4900'; // المبلغ بالوحدات الصغرى، مطابق لطلبك
const secret = 'pri_sandbox_...';
const url = 'https://<project-ref>.supabase.co/functions/v1/youcanpay-webhook';

const body = JSON.stringify({
  id: 'evt_test_' + Date.now(),
  event_name: 'transaction.paid',
  sandbox: true,
  payload: {
    transaction: {
      id: 'tx_test_' + Date.now(),
      order_id: order,
      amount,
      currency: 'MAD',
      status: 1
    }
  }
});

const { createHmac } = await import('node:crypto');
const signature = createHmac('sha256', secret).update(body).digest('hex');
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-YOUCANPAY-SIGNATURE': signature
  },
  body
});
console.log(res.status, await res.text());
```

شغّله بـ`node test-webhook.mjs`. يجب أن يعيد `200 {"ok":true}`. إذا أعاد
`invalid_signature` راجع المفتاح الخاص، وإذا أعاد `payment_mismatch` راجع
المبلغ والعملة.

### 3.9 الانتقال إلى Live

بعد نجاح Sandbox:

1. أكمل تحقق التاجر في YouCan Pay.
2. انسخ مفاتيح Live: `pub_...` و`pri_...`.
3. في رابطي ← **المدفوعات**، ألصقهما، **أوقف** وضع Sandbox، وفعّل الدفع.
4. احفظ، ثم أضف نطاقك الحقيقي إلى **Allowed hosts**.
5. أنشئ Webhook Live إن لم يكن موجودًا، بنفس الرابط.
6. جرّب عملية حقيقية بمبلغ صغير، ثم استردها من لوحة YouCan Pay إذا أردت.

لا تنشر المتجر للجمهور قبل اختبار Live بمبلغ صغير؛ Sandbox لا يثبت أن حسابك
البنكي وبيانات التاجر مكتملة.

---

## 4. قائمة تحقق نهائية

- [ ] `schema.sql` ثم `v2.sql` نُفذا بدون أخطاء.
- [ ] جداول `rabiti_*` موجودة.
- [ ] Site URL وRedirect URLs مضبوطان.
- [ ] SMTP مخصص مضبوط قبل فتح التسجيل.
- [ ] `config.js` يحتوي Project URL وPublishable Key فقط.
- [ ] Access Token مقيّد بالصلاحيات المطلوبة.
- [ ] `supabase link` ناجح.
- [ ] الدالتان منشورتان بـ`--no-verify-jwt`.
- [ ] مفاتيح Sandbox محفوظة مع تفعيل وضع Sandbox.
- [ ] النطاقات مضافة إلى Allowed hosts.
- [ ] Webhook مضاف ويستقبل 200.
- [ ] طلب تجريبي نجح وتحول إلى مسلّم.
- [ ] التحميل يعمل من صفحة الطلب.
- [ ] طريقة دفع يدوية تعمل كخطة بديلة.

---

## 5. مشاكل شائعة

| المشكلة | السبب المرجح | الحل |
| --- | --- | --- |
| `Email address not authorized` | SMTP الافتراضي يرسل لأعضاء الفريق فقط | أضف بريدك للفريق أو اضبط SMTP مخصصًا |
| لا يصل بريد التأكيد | SMTP افتراضي أو حد 2/ساعة | اضبط SMTP، وراجع Spam |
| `host_not_allowed` | النطاق غير مسموح في YouCan Pay | أضف `localhost:8080` و`elkandoussi1.github.io` |
| `payment_not_configured` | المفاتيح غير محفوظة أو الدفع غير مفعّل | أعد حفظ المفاتيح وفعّل الدفع |
| `tokenize_failed` | مفتاح Sandbox مع وضع Live أو العكس | طابق الوضع مع بادئة المفتاح |
| `invalid_signature` | المفتاح الخاص مختلف أو الجسم تغيّر | حدّث المفتاح، وأرسل الجسم الخام |
| `payment_mismatch` | المبلغ أو العملة لا يطابقان الطلب | راجع سعر المنتج وعملة المتجر |
| الطلب يبقى معلقًا | Webhook لم يصل أو فشل | راجع Logs وWebhook History |
| `relation "rabiti_orders" does not exist` | `v2.sql` لم يُنفذ | شغّله بعد `schema.sql` |
| `AUTH_REQUIRED` | الجلسة منتهية | سجّل الدخول من جديد |

---

## 6. المراجع

- Supabase CLI: <https://supabase.com/docs/guides/cli>
- Access Tokens: <https://supabase.com/docs/guides/platform/access-tokens>
- API Keys: <https://supabase.com/docs/guides/api/api-keys>
- Auth Redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Custom SMTP: <https://supabase.com/docs/guides/auth/auth-smtp>
- YouCan Pay: <https://docs.youcan.shop/youcan-pay/introduction>
- YouCan Pay Sandbox: <https://docs.youcan.shop/youcan-pay/yp-js/sandbox>
- YouCan Pay Webhooks: <https://docs.youcan.shop/youcan-pay/webhooks>
