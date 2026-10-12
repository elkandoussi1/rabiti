/* Cloud adapter for the existing Rabiti editor; public.html never loads this file. */
const CLOUD = (()=>{
 const cfg=window.RABITI_CONFIG||{};
 let client, user, store, queue=Promise.resolve(), view='login', recovery=false, status='';
 const enabled=!!(cfg.supabaseUrl&&cfg.supabasePublishableKey)&&new URL(location.href).searchParams.get('local')!=='1';
 const slugOK=s=>/^[a-z0-9][a-z0-9-]{2,39}$/.test(s);
 const url=s=>{const u=new URL('public.html',location.href);u.searchParams.set('store',s);return u.href};
 function message(e){const m=e?.message||String(e);if(m.includes('REVISION_CONFLICT'))return 'توجد تعديلات أحدث من جهاز آخر. صدّر نسختك ثم أعد تحميل الصفحة قبل المتابعة.';if(m.includes('PAID_DELIVERY'))return 'نشر المنتجات المدفوعة يتطلب خدمة تسليم آمنة. أخفها أو استخدم رابط شراء خارجي.';if(e?.code==='23505')return 'اسم المتجر محجوز، اختر اسمًا آخر.';return m==='Failed to fetch'?'تعذر الاتصال. لم تُحفظ التعديلات سحابيًا؛ أعد المحاولة أو صدّر نسخة.':m}
 function fail(e){status=message(e);const n=$('#cloud-status');if(n)n.textContent=status;const a=$('#cloud-error');if(a)a.textContent=status;toast(status,5000)}
 function auth(v='login',msg=''){
 view=v;$('#app').style.display='none';$('#auth').style.display='flex';
 const reset=v==='reset',forgot=v==='forgot',reg=v==='register';
 $('#auth').innerHTML='<div class="acard" dir="rtl"><div class="alogo">🔗</div><h1>رابطي</h1><p>حساب واحد ومتجرك متاح من أي جهاز</p><form id="cloud-form">'+(!reset?'<label class="l">البريد الإلكتروني</label><input id="ce" type="email" autocomplete="email" required>':'')+(!forgot?'<label class="l">'+(reset?'كلمة المرور الجديدة':'كلمة المرور')+'</label><input id="cp" type="password" minlength="8" autocomplete="'+(reg||reset?'new-password':'current-password')+'" required>':'')+(reg?'<label class="l">أعد كلمة المرور</label><input id="cp2" type="password" minlength="8" autocomplete="new-password" required>':'')+'<p id="cloud-error" class="msg e">'+esc(msg)+'</p><button class="btn w" id="cloud-submit">'+(reset?'حفظ كلمة المرور':forgot?'إرسال رابط الاسترجاع':reg?'إنشاء حساب':'دخول')+'</button></form>'+(!reset?'<div class="row" style="margin-top:14px"><button class="btn o sp" onclick="CLOUD.auth(\'login\')">دخول</button><button class="btn o sp" onclick="CLOUD.auth(\'register\')">حساب جديد</button></div><button class="lnk" onclick="CLOUD.auth(\'forgot\')">نسيت كلمة المرور</button>':'')+'<p><a href="index.html?local=1">فتح النسخة المحلية لنقل بياناتي القديمة</a></p></div>';
 $('#cloud-form').onsubmit=submit;
 }
 async function submit(e){e.preventDefault();const b=$('#cloud-submit');b.disabled=true;
 try{const email=$('#ce')?.value.trim(),password=$('#cp')?.value;
 if(view==='register'){
 if(password!==$('#cp2').value)throw Error('كلمتا المرور غير متطابقتين');
 const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('index.html',location.href).href}});if(error)throw error;
 if(data.session){await enter();return}auth('login','راجع بريدك لتأكيد الحساب ثم سجّل الدخول.');return;
 }
 if(view==='forgot'){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('index.html',location.href).href});if(error)throw error;auth('login','إذا كان البريد مسجّلًا فسيصلك رابط الاسترجاع.');return}
 if(view==='reset'){const {error}=await client.auth.updateUser({password});if(error)throw error;recovery=false;await enter();return}
 const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await enter();
 }catch(x){fail(x)}finally{if(b.isConnected)b.disabled=false}
 }
 async function enter(){const {data,error}=await client.auth.getUser();if(error)throw error;user=data.user;ACC={id:user.id,email:user.email};KEY=null;
 const q=await client.from('rabiti_stores').select('slug,draft,revision').eq('owner_id',user.id).maybeSingle();if(q.error)throw q.error;store=q.data;
 if(!store){setup();return}S=norm0(store.draft);S.siteUrl=url(store.slug);siteHtmlCache=null;startApp();
 }
 function setup(){auth('login');$('#auth').innerHTML='<div class="acard" dir="rtl"><h1>اختر رابط متجرك</h1><p>اسم من 3 إلى 40 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة، يبدأ بحرف أو رقم.</p><form id="store-form"><input id="store-slug" dir="ltr" placeholder="ahmed" pattern="[a-z0-9][a-z0-9-]{2,39}" required><p id="cloud-error" class="msg e"></p><button class="btn w" id="create-store">إنشاء المتجر</button></form><button class="lnk" onclick="CLOUD.logout()">خروج</button></div>';
 $('#store-form').onsubmit=async e=>{e.preventDefault();const b=$('#create-store');b.disabled=true;try{const slug=$('#store-slug').value.trim();if(!slugOK(slug))throw Error('اسم الرابط غير صالح');const d=defaults();d.profile.name=slug;const {error}=await client.from('rabiti_stores').insert({owner_id:user.id,slug,draft:d});if(error)throw error;await enter()}catch(x){fail(x)}finally{if(b.isConnected)b.disabled=false}};
 }
 // Capture each draft before enqueueing; CAS prevents one device overwriting another.
 function persist(){if(!user||!store||!S)return Promise.resolve(true);const snapshot=clone(S),owner=user.id;
 const job=queue.catch(()=>{}).then(async()=>{if(user?.id!==owner)throw Error('تغير الحساب قبل الحفظ');const r=await client.rpc('rabiti_save',{p_draft:snapshot,p_revision:store.revision});if(r.error)throw r.error;store.revision=r.data;status='تم حفظ المسودة ✓';const n=$('#cloud-status');if(n)n.textContent=status;return true});queue=job;return job.catch(e=>{fail(e);return false})}
 async function publish(){clearTimeout(saveT);if(!await persist())return;try{const {data,error}=await client.rpc('rabiti_publish',{p_revision:store.revision});if(error)throw error;S.siteUrl=url(data);S.dirty=0;status='نُشرت التعديلات ✓';render();toast(status)}catch(e){fail(e)}}
 async function unpublish(){if(!confirm('إيقاف إتاحة صفحتك للزوار؟ تبقى مسودتك محفوظة.'))return;try{const {error}=await client.rpc('rabiti_unpublish');if(error)throw error;status='تم إيقاف النشر';render()}catch(e){fail(e)}}
 async function logout(){clearTimeout(saveT);if(S&&!await persist())return;const {error}=await client.auth.signOut();if(error)return fail(error);user=null;store=null;ACC=null;S=null;document.querySelectorAll('.pv').forEach(n=>n.remove());closeS();auth()}
 function panel(){return '<div class="card" dir="rtl"><h2>متجرك على الإنترنت</h2><p>التعديلات تُحفظ كمسودة. اضغط نشر لتظهر للزبائن على الرابط نفسه.</p><input dir="ltr" readonly value="'+esc(url(store.slug))+'"><div class="row"><button class="btn sp" onclick="CLOUD.publish()">نشر التعديلات</button><button class="btn o sp" onclick="CLOUD.copy()">نسخ الرابط</button></div><div class="row" style="margin-top:8px"><a class="btn o sp" target="_blank" rel="noopener" href="'+esc(url(store.slug))+'">فتح الصفحة العامة</a><button class="btn o sp" onclick="X.preview()">معاينة المسودة</button></div><p id="cloud-status" class="mu">'+esc(status||'المسودة لا تظهر للزوار حتى تنشرها')+'</p><button class="btn o w" onclick="CLOUD.unpublish()">إيقاف النشر</button></div><div class="card"><b>'+esc(user.email)+'</b><p>بياناتك محفوظة في حسابك على الإنترنت.</p><button class="btn o w" onclick="CLOUD.logout()">خروج</button><button class="lnk" onclick="CLOUD.forgot()">استرجاع أو تغيير كلمة المرور عبر البريد</button></div><div class="card"><b>نسخة احتياطية ونقل البيانات القديمة</b><p>استورد نسخة JSON صدّرتها من الحساب المحلي، ثم انشرها. لا تُنقل الحسابات المحلية تلقائيًا.</p><div class="row"><button class="btn o sp" onclick="X.exp()">تصدير</button><label class="btn o sp">استيراد<input type="file" hidden accept=".json" onchange="X.imp(this.files[0])"></label></div><button class="btn o w" style="margin-top:8px" onclick="CLOUD.retry()">إعادة محاولة حفظ المسودة</button></div>'}
 async function copy(){try{await navigator.clipboard.writeText(url(store.slug));toast('تم نسخ الرابط')}catch(e){toast('يمكنك نسخ الرابط من الخانة أعلاه')}}
 async function init(){if(!enabled)return false;
 if(!window.supabase)throw Error('تعذر تحميل مكوّن الاتصال السحابي');
 client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
 recovery=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
 client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){recovery=true;auth('reset')}});
 AU.logout=logout;window.CLOUD=api;
 // Replace editor persistence and publishing through global function bindings.
 const {data,error}=await client.auth.getSession();if(error)throw error;
 if(recovery&&data.session)auth('reset');else if(data.session)await enter();else auth();return true;
 }
 const api={enabled,auth,init,persist,publish,unpublish,logout,panel,copy,retry:()=>persist(),forgot:()=>{closeS();auth('forgot')},fail,slugOK};return api;
})();
if(CLOUD.enabled){persist=CLOUD.persist;rPub=CLOUD.panel;AU.logout=CLOUD.logout;}
