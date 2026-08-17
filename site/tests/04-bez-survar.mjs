import { chromium } from '/opt/node-tools/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/nb',{recursive:true});
const B='http://localhost:8081';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:900}});
const prob=[]; p.on('pageerror',e=>prob.push('JS: '+e.message));
const T=()=>p.evaluate(()=>document.getElementById('app')?.innerText||'');
await p.goto(B,{timeout:60000}); await p.waitForTimeout(3500);
const cc=p.getByRole('button',{name:/Приемам всички/}); if(await cc.count()) await cc.click();
console.log('  начална страница:', (await T()).slice(0,60).replace(/\n/g,' ')||'(празно)');
await p.screenshot({path:'/tmp/nb/01-landing.png'});
for (const h of ['#/packages','#/login','#/faq','#/subject/oblp']){
  await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(3000);
  const t=await T();
  console.log(`  ${h.padEnd(18)} → ${t.length} знака | ${t.slice(0,70).replace(/\n/g,' ')}`);
}
await p.screenshot({path:'/tmp/nb/02-subject-nobackend.png'});
console.log('  JS грешки:', prob.length?prob.slice(0,3):'няма');
await b.close();
