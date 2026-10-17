const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
(async()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://example.com/rabiti/?local=1',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
 Object.assign(w,{TextEncoder,TextDecoder,matchMedia:()=>({matches:false}),scrollTo:()=>{}});w.CLOUD={enabled:false};
 for(const[,a,s]of read('index.html').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!a.includes('text/plain')&&!a.includes('src=')&&!s.includes('beforeinstallprompt'))vm.runInContext(s,ctx);
 vm.runInContext(read('commerce-editor.js'),ctx);
 vm.runInContext(`S=defaults();S.profile.name='Teacher';S.products=[{id:'old',t:'Old product',d:'Description',pr:'49',cur:'',imgs:[],on:1,mode:'paid',link:'',src:{type:'url',url:'https://example.com/private.pdf'},lm:{codes:[{c:'PRIVATE-CODE'}]}}];X.prod()`,ctx);
 assert.equal(vm.runInContext('P.mode',ctx),'checkout');assert.equal(vm.runInContext('P.cur',ctx),'USD');assert(!w.document.querySelector('[onclick="X.pMode(\'paid\')"]'));
 vm.runInContext(`X.prod('old')`,ctx);assert.equal(vm.runInContext('P.mode',ctx),'checkout');assert.equal(vm.runInContext('P.cur',ctx),'MAD');assert.equal(vm.runInContext('S.products[0].mode',ctx),'paid');assert(w.document.querySelector('.commerce-notice').textContent.includes('الطريقة القديمة'));
 await vm.runInContext('X.saveP()',ctx);assert.equal(vm.runInContext('S.products[0].mode',ctx),'paid');
 vm.runInContext(`P.link='https://teacher.gumroad.com/l/book'`,ctx);await vm.runInContext('X.saveP()',ctx);assert.equal(vm.runInContext('S.products[0].mode',ctx),'checkout');assert.equal(vm.runInContext('S.products[0].lm.codes[0].c',ctx),'PRIVATE-CODE');assert(!JSON.stringify(vm.runInContext('exportData()',ctx)).includes('PRIVATE'));
 vm.runInContext(`go('shop')`,ctx);assert(w.document.querySelector('#main').textContent.includes('الدفع والتسليم التلقائي'));assert(!w.document.querySelector('#main').textContent.includes('قنوات استلام إثبات الدفع'));assert(!w.document.querySelector('#main').textContent.includes('RIB'));
 w.close();
 const updateDom=new JSDOM('<body></body>'),messages=[];let saved=0,reloads=0,saveResult=false;
 const updateContext=vm.createContext({window:{addEventListener(){}},document:updateDom.window.document,navigator:{},location:{href:'https://example.com/rabiti/',protocol:'https:',reload(){reloads++}},S:{},saveT:null,persist:async()=>{saved++;return saveResult},toast:m=>messages.push(m),clearTimeout,URL,Date,fetch:async()=>({ok:true,json:async()=>({version:'new-version'})})});
 vm.runInContext(read('app-update.js'),updateContext);const updates=updateContext.window.RABITI_UPDATES;
 await updates.check(true);assert(updateDom.window.document.querySelector('#app-update-banner'));
 const sheet=updateDom.window.document.createElement('div');sheet.className='sheet';updateDom.window.document.body.append(sheet);await updates.apply();assert.equal(saved,0);assert.equal(reloads,0);sheet.remove();
 await updates.apply();assert.equal(saved,1);assert.equal(reloads,0);saveResult=true;await updates.apply();assert.equal(saved,2);assert.equal(reloads,1);updateDom.window.close();
 const handlers={},worker={location:{origin:'https://example.com'},registration:{scope:'https://example.com/rabiti/'},addEventListener:(name,handler)=>handlers[name]=handler};vm.runInNewContext(read('sw.js'),{self:worker,URL});
 for(const path of ['public.html?store=ahmed','missing.html']){let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://example.com/rabiti/'+path,mode:'navigate'},respondWith(){intercepted=true}});assert.equal(intercepted,false)}
 console.log('PASS automatic defaults, safe legacy setup, hidden manual payment controls, draft-preserving updates, public cache isolation');
})().catch(e=>{console.error(e);process.exit(1)});
