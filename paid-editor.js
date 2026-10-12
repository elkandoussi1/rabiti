/* Manual-payment delivery: code generation is fast; redemption state belongs to the server. */
if(CLOUD.enabled){
 const originalSaveP=X.saveP;
 const cloudCode=()=>Array.from(rnd(20),b=>AL[b%32]).join('').match(/.{1,5}/g).join('-');
 const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
 X.saveP=async function(){
  const p=P;if(p.mode!=='paid')return originalSaveP.call(X);
  try{const src=p.src||{},source=src.type==='file'?src.data:String(src.url||'').trim();if(!source)throw Error('حدّد الملف أو رابط التسليم أولًا.');if(src.type!=='file'&&!/^https?:\/\//i.test(source))throw Error('رابط التسليم يجب أن يبدأ بـ https://');
  const sig=await hash(JSON.stringify([src.type,source,src.fn||'']));
  const legacy=src.type+'|'+(src.type==='url'?source:src.fn+'|'+source.length);
  const keep=p.lm?.codes?.length&&(p.lm.sig===sig||p.lm.sig===legacy);
  const codes=keep?p.lm.codes:Array.from({length:Math.min(60,Math.max(1,+p.nc||10))},()=>({c:cloudCode(),note:'',used:0}));
  p.t=p.t.trim()||'منتج';p.lm={lock:'server-v1',sig,fn:src.type==='file'?src.fn:'',codes};
  const i=S.products.findIndex(x=>x.id===p.id);if(i<0)S.products.push(p);else S.products[i]=p;
  save();closeS();render();toast('تم حفظ المنتج. اضغط نشر التعديلات لتفعيله في المتجر.');
  }catch(e){toast(e.message,4500)}
 };
 X.cAdd=async function(id){const p=find(S.products,id);if(!p?.lm)return;p.lm.codes.push(...Array.from({length:10},()=>({c:cloudCode(),note:'',used:0})));save();await X.codes(id);toast('أعد النشر لتصبح الأكواد الجديدة صالحة.')};
 let sheetSequence=0;
 X.codes=async function(id){const p=find(S.products,id);if(!p?.lm)return;const seq=++sheetSequence;sheet(hdS('🔑 '+esc(p.t))+'<p id="code-loading">جارٍ تحديث حالة الأكواد…</p>');
 let states;try{states=await CLOUD.codeStatus(id)}catch(e){if(seq===sheetSequence&&$('#code-loading'))$('#code-loading').textContent='تعذر تحديث الحالة. أعد فتح النافذة بعد الاتصال.';return}
 const mapped=await Promise.all(p.lm.codes.map(async c=>{const h=await hash(norm(c.c));return {c,state:states.find(s=>s.hash===h)}}));
 if(seq!==sheetSequence||!$('#code-loading'))return;
 const free=mapped.filter(x=>x.state?.active&&!x.state?.redeemed_at&&!x.state?.revoked&&!x.c.used).length;
 sheet(hdS('🔑 '+esc(p.t))+'<p>الأكواد الجاهزة للإرسال: '+free+'. أرسل الكود بعد التحقق من الدفع. حالة «مرسل» للحجز، وحالة «مفعّل» تأتي من الخادم.</p>'+mapped.map(({c,state},i)=>{const badge=state?.revoked?'ملغى':state?.redeemed_at?'مفعّل ✓':!state?.active?'يحتاج نشرًا':c.used?'مرسل':'متاح';const blocked=!state?.active||state?.revoked||state?.redeemed_at;return '<div class="li"><div class="sp"><div class="code">'+esc(c.c)+'</div><small>'+badge+'</small><input data-note="'+i+'" placeholder="اسم المشتري / ملاحظة" value="'+esc(c.note)+'"></div><button class="btn o sm" data-copy="'+i+'" '+(blocked?'disabled':'')+'>نسخ الرسالة</button><button class="btn g sm" data-wa="'+i+'" '+(blocked?'disabled':'')+'>WA</button></div>'}).join('')+'<button class="btn w" id="add-cloud-codes">إضافة 10 أكواد جديدة</button><p class="mu">بعد إضافة الأكواد أعد النشر. الكود لا يتفعّل على متصفحين مختلفين؛ يمكن للمشتري إعادة التحميل على المتصفح الذي فعّله.</p>');
 $('#add-cloud-codes').onclick=()=>X.cAdd(id);
 $$('.sheet [data-note]').forEach(n=>n.oninput=()=>{p.lm.codes[+n.dataset.note].note=n.value;save()});
 function msg(i){return p.t+'\nكود التفعيل: '+p.lm.codes[i].c+'\n'+CLOUD.publicUrl()}
 $$('.sheet [data-copy]').forEach(n=>n.onclick=async()=>{const i=+n.dataset.copy;try{await navigator.clipboard.writeText(msg(i));p.lm.codes[i].used=1;save();await X.codes(id);toast('تم نسخ الرسالة')}catch(e){toast('تعذر النسخ؛ انسخ الكود من الخانة.')}});
 $$('.sheet [data-wa]').forEach(n=>n.onclick=()=>{const i=+n.dataset.wa;window.open('https://wa.me/?text='+encodeURIComponent(msg(i)),'_blank','noopener');p.lm.codes[i].used=1;save();X.codes(id)});
 };
}
