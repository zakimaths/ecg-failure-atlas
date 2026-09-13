import {readFile,mkdir} from 'node:fs/promises';
import {cli,localServer,resultOf,output} from './browser-support.mjs';
const browsers=process.argv.slice(2).length?process.argv.slice(2):['chrome','webkit'];
await mkdir(output,{recursive:true});const server=await localServer(process.env.ATLAS_GALLERY||'gallery');
try{for(const browser of browsers){const session='atlas-beats-'+browser+'-'+process.pid;try{
 await cli(session,'open',server.url+'/clinical.html#beat-section','--browser',browser);await cli(session,'snapshot');
 const text=await cli(session,'run-code',`async page=>{
 const assert=(v,m)=>{if(!v)throw Error(m);};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.getElementById('beat-status').textContent.startsWith('Detection comparison complete'));
 await ready();assert(await page.locator('#beat-rows tr').count()>0,'No events');
 await page.locator('#cutoff_hz').fill('0');assert(await page.locator('#beat-json').isDisabled(),'Stale processing export');assert(await page.locator('#beat-run').isDisabled(),'Unapplied processing accepted');
 await page.locator('#run-clinical').click();await ready();
 assert(await page.evaluate(()=>{const p=document.getElementById('beat-chart').data;return p.length===4&&JSON.stringify(p[2].x)===JSON.stringify(p[3].x)&&p[2].x.length>0;}),'Identity candidates');
 assert(await page.locator('#beat-metrics .metric-value').nth(1).innerText()==='0','Identity unmatched');
 await page.locator('#beat-energy').click();await page.waitForFunction(()=>document.getElementById('beat-chart').data.length===3);
 assert(await page.evaluate(()=>document.getElementById('beat-chart').data[2].name==='Shared threshold'),'Threshold view');
 await page.locator('#beat-wave').click();await page.waitForFunction(()=>document.getElementById('beat-chart').data.length===4);
 await page.locator('#beat-threshold').fill('0.4');assert(await page.locator('#beat-json').isDisabled(),'Stale detector export');
 await page.locator('#beat-refractory').fill('300');await page.locator('#beat-tolerance').fill('50');await page.locator('#beat-run').click();await ready();
 await page.locator('#cutoff_hz').fill('12');await page.locator('#clip_mv').fill('0.4');await page.locator('#mode').selectOption('causal');await page.locator('#taps').selectOption('101');
 await page.context().setOffline(true);await page.locator('#run-clinical').click();await ready();await page.context().setOffline(false);
 let promise=page.waitForEvent('download');await page.locator('#beat-json').click();await(await promise).saveAs('${output}/${browser}-beats.json');
 promise=page.waitForEvent('download');await page.locator('#beat-csv').click();await(await promise).saveAs('${output}/${browser}-beats.csv');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:document.getElementById('beat-section').offsetTop-20,behavior:'instant'}));await page.screenshot({path:'${output}/${browser}-beats.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>{const e=document.getElementById('beat-chart');return Math.abs(e.querySelector('.main-svg').getBoundingClientRect().width-e.clientWidth)<2;});await page.waitForFunction(()=>[...document.querySelectorAll('.lab-chart')].filter(e=>e.data).every(e=>Math.abs(e.querySelector('.main-svg').getBoundingClientRect().width-e.clientWidth)<2));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');await page.locator('#beat-chart').screenshot({path:'${output}/${browser}-beats-mobile.png'});
 assert(!errors.length,errors.join(';'));return {status:'passed',browser:'${browser}',checks:['direct section link','identity detections','shared threshold view','detector settings','processing changes','stale export protection','offline','JSON and CSV','mobile fit']};
 }`);
 const result=resultOf(text);if(result.status!=='passed')throw Error(text);
 const d=JSON.parse(await readFile(output+'/'+browser+'-beats.json','utf8')),csv=(await readFile(output+'/'+browser+'-beats.csv','utf8')).trimEnd().split('\n');
 if(!csv[0].includes('ODC Attribution'))throw Error('CSV attribution');
 const lines=csv.filter(l=>!l.startsWith('#'));lines.shift();const det=d.detection;
 if(lines.length!==det.matches.length+det.recorded_only.length+det.output_only.length)throw Error('CSV event coverage');
 for(const line of lines){const [kind,r,o,shift,adjusted]=line.split(',');if(kind==='Matched'&&!det.matches.some(m=>m.recorded_sample===+r&&m.output_sample===+o&&m.shift_ms===+shift&&m.adjusted_shift_ms===+adjusted))throw Error('CSV match');if(kind==='Recorded only'&&!det.recorded_only.includes(+r))throw Error('CSV recorded event');if(kind==='Processed only'&&!det.output_only.includes(+o))throw Error('CSV processed event');}
 console.log(JSON.stringify(result));
 }finally{await cli(session,'close').catch(()=>{});}}
}finally{await server.close();}
