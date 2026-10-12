/* Customer route: no editor, no Auth SDK, no access to draft APIs or local accounts. */
(async()=>{
 const status=document.getElementById('public-status');
 function safeUrl(v,image=false,file=false){if(!v)return '';v=String(v);if(image&&/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(v))return v;if(file&&/^data:[a-z0-9.+/-]+;base64,[a-z0-9+/=]+$/i.test(v)&&!/^data:(text\/html|image\/svg|application\/javascript)/i.test(v))return v;try{const u=new URL(v);return ['http:','https:','mailto:','tel:'].includes(u.protocol)&&(!image||/^https?:$/.test(u.protocol))?u.href:''}catch{return ''}}
 function sanitize(d){
 d.profile=d.profile||{};d.profile.avatar=safeUrl(d.profile.avatar,true);
 d.links=(d.links||[]).map(l=>({...l,u:safeUrl(l.u)}));
 d.products=(d.products||[]).map(p=>({...p,imgs:(p.imgs||[]).map(v=>safeUrl(v,true)).filter(Boolean),link:safeUrl(p.link),data:safeUrl(p.data,false,true)}));
 d.pay=(d.pay||[]).map(p=>({...p,u:safeUrl(p.u)}));d.shop=d.shop||{};d.shop.payUrl=safeUrl(d.shop.payUrl);d.sub=d.sub||{};d.sub.endpoint=safeUrl(d.sub.endpoint);
 const c=d.design||{};d.design={};
 for(const [k,allowed]of Object.entries({shape:['sharp','soft','round','pill'],fill:['solid','outline','glass'],social:['icons','buttons'],divider:['none','line','dots'],ratio:['1/1','4/3','3/4','16/9'],fit:['cover','contain'],mode:['auto','light','dark'],cols:['auto','1','2','3','4','5','6'],font:['cairo','tajawal','almarai','plex','readex','messiri','reem','lemonada','changa','amiri','playfair','poppins','']}))if(allowed.includes(String(c[k])))d.design[k]=String(c[k]);
 for(const k of ['theme','price','desc','footerOn','hideMode'])if(Number.isFinite(+c[k]))d.design[k]=+c[k];
 for(const k of ['title','footer'])d.design[k]=String(c[k]||'');
 if(/^#[a-f0-9]{3,8}$/i.test(c.accent||''))d.design.accent=c.accent;
 if(/^[a-z0-9#().,%\s-]+$/i.test(c.bg||''))d.design.bg=c.bg;
 return d;
 }
 try{
 const slug=new URL(location.href).searchParams.get('store');if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug||''))throw Error('رابط المتجر غير صالح.');
 const c=window.RABITI_CONFIG;if(!c?.supabaseUrl||!c.supabasePublishableKey)throw Error('لم تُفعّل خدمة المتاجر بعد.');
 const u=new URL('/rest/v1/rabiti_pages',c.supabaseUrl);u.searchParams.set('slug','eq.'+slug);u.searchParams.set('select','payload');
 const response=await fetch(u,{headers:{apikey:c.supabasePublishableKey},cache:'no-store'});if(!response.ok)throw Error('تعذر تحميل المتجر، أعد المحاولة.');
 const rows=await response.json();if(!rows.length)throw Error('هذا المتجر غير منشور أو أوقف صاحبه النشر.');

 // Persist the receipt before the request: retries after a dropped response are safe.
 const receiptKey=p=>'rb_receipt_'+slug+'_'+p.id;
 function readReceipt(p,pending=false){try{return JSON.parse(localStorage.getItem(receiptKey(p)+(pending?'_pending':''))||'null')}catch{return null}}
 async function rpc(name,args){const r=await fetch(new URL('/rest/v1/rpc/'+name,c.supabaseUrl),{method:'POST',headers:{apikey:c.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});if(!r.ok)throw Error('تعذر الاتصال بخدمة التفعيل. أعد المحاولة.');return r.json()}
 function delivery(p,result){if(!result)return null;const u=safeUrl(result.source,false,true);if(!u)throw Error('رابط التسليم غير صالح. تواصل مع البائع.');p.fn=result.filename||'';return u}
 window.RABITI_DELIVERY={
 async redeem(p,code){const normalized=String(code).toUpperCase().replace(/[^A-Z0-9]/g,'');const confirmed=readReceipt(p),pending=readReceipt(p,true);let saved=confirmed?.code===normalized?confirmed:pending?.code===normalized?pending:null;if(!saved)saved={code:normalized,token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};try{localStorage.setItem(receiptKey(p)+'_pending',JSON.stringify(saved))}catch{throw Error('فعّل تخزين المتصفح قبل استعمال الكود حتى تستطيع إعادة التحميل.')}
 const result=await rpc('rabiti_redeem',{p_slug:slug,p_product_id:p.id,p_code:code,p_receipt:saved.token});if(!result)throw Error('الكود غير صحيح أو سبق تفعيله على متصفح آخر.');try{localStorage.setItem(receiptKey(p),JSON.stringify(saved));localStorage.removeItem(receiptKey(p)+'_pending')}catch{}return delivery(p,result)
 },
 async resume(p){for(const saved of [readReceipt(p,true),readReceipt(p)]){if(!saved)continue;const result=await rpc('rabiti_download',{p_slug:slug,p_product_id:p.id,p_receipt:saved.token});if(result)return delivery(p,result)}return null}
 };
 document.getElementById('rb-data').textContent=JSON.stringify(sanitize(rows[0].payload));
 const script=document.createElement('script');script.src='store-renderer.js';script.onload=()=>status.remove();script.onerror=()=>{status.textContent='تعذر تحميل الصفحة، أعد المحاولة.'};document.body.appendChild(script);
 }catch(e){document.getElementById('rb').remove();status.textContent=e.message}
})();
