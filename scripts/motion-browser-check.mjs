import {cli,localServer,resultOf,output} from './browser-support.mjs';
import {mkdir} from 'node:fs/promises';
await mkdir(output,{recursive:true});
const browsers=process.argv.slice(2).length?process.argv.slice(2):['chrome','webkit'];
const server=await localServer(process.env.ATLAS_GALLERY||'gallery');
try{for(const browser of browsers){const session=`atlas-motion-${browser}-${process.pid}`;try{
 await cli(session,'open',server.url+'/clinical.html','--browser',browser);await cli(session,'snapshot');
 const code=`async page=>{
 const assert=(v,m)=>{if(!v)throw Error(m);};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['clinical.html','lab.html']){
  await page.goto('${server.url}/'+path);await page.waitForFunction(()=>document.querySelectorAll('.process-stage svg path').length===3);
  const clinical=path==='clinical.html';const run=clinical?'#run-clinical':'#run';
  const ready=()=>page.waitForFunction(id=>!document.querySelector(id).disabled,run);await ready();
  const before=await page.evaluate(()=>JSON.stringify(document.querySelector('#clinical-chart,#lab-chart').data.map(t=>t.y)));
  assert(await page.locator('.process-preview').getAttribute('data-playing')==='false','Autoplay on load');
  await page.locator('.process-preview button').click();await page.waitForFunction(()=>document.querySelector('.process-preview').dataset.playing==='true');
  await page.waitForFunction(()=>document.querySelectorAll('.process-stage[data-active=true]').length===1);
  await page.locator('.process-preview').screenshot({path:'${output}/'+(clinical?'clinical':'synthetic')+'-motion-${browser}.png'});
  await page.waitForFunction(()=>document.querySelector('.process-status').textContent==='Playback complete.');
  assert(await page.evaluate(()=>JSON.stringify(document.querySelector('#clinical-chart,#lab-chart').data.map(t=>t.y)))===before,'Playback altered analysis samples');
  await page.locator('.process-preview button').click();await page.locator('.process-preview button').click();assert(await page.locator('.process-preview').getAttribute('data-playing')==='false','Stop failed');
  await page.locator('.process-preview button').click();await page.locator('#clip_mv').fill('0.4');assert(await page.locator('.process-preview button').isDisabled(),'Dirty playback enabled');
  await page.locator(run).click();await ready();
  assert(await page.evaluate(()=>{
   const clinical=!!document.getElementById('clinical-chart');const p=document.querySelectorAll('.process-stage path');
   const values=clinical?document.getElementById('clinical-chart').data[0].y:document.getElementById('lab-chart').data[1].y;
   return p[0].getAttribute('d').split('L').length===values.length&&p[1].getAttribute('d')!==p[0].getAttribute('d');
  }),'Preview omits samples or clipping stage');
  await page.locator('.process-preview button').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.process-preview button').disabled);
  assert(await page.locator('.process-preview button').isDisabled(),'Reduced motion ignored');
  assert(await page.locator('.process-preview').getAttribute('data-playing')==='false','Reduced motion did not cancel');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!document.querySelector('.process-preview button').disabled);
  await page.locator('.process-preview button').focus();await page.keyboard.press('Enter');assert(await page.locator('.process-preview').getAttribute('data-playing')==='false','Keyboard motion');
  await page.setViewportSize({width:390,height:844});
  await page.locator('.process-preview').screenshot({path:'${output}/'+(clinical?'clinical':'synthetic')+'-motion-mobile-${browser}.png'});
  assert(await page.locator('.process-preview').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'Preview overflow');
  await page.setViewportSize({width:1440,height:1000});
 }
 assert(!errors.length,errors.join(';'));return {status:'passed',browser:'${browser}',checks:['both pages','no autoplay','sequential playback','stop','exact sample paths','stable numerical plots','dirty cancellation','reduced motion and live change','keyboard static view','mobile fit']};
 }`;
 const text=await cli(session,'run-code',code),result=resultOf(text);if(result.status!=='passed')throw Error(text);console.log(JSON.stringify(result));
 }finally{await cli(session,'close').catch(()=>{});}}
}finally{await server.close();}
