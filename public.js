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
 document.getElementById('rb-data').textContent=JSON.stringify(sanitize(rows[0].payload));
 const script=document.createElement('script');script.src='store-renderer.js';script.onload=()=>status.remove();script.onerror=()=>{status.textContent='تعذر تحميل الصفحة، أعد المحاولة.'};document.body.appendChild(script);
 }catch(e){document.getElementById('rb').remove();status.textContent=e.message}
})();
