import {readFile,mkdir} from 'node:fs/promises';
import {cli,localServer,resultOf,output} from './browser-support.mjs';
const browsers=process.argv.slice(2).length?process.argv.slice(2):['chrome','webkit'];
await mkdir(output,{recursive:true});const server=await localServer(process.env.ATLAS_GALLERY||'gallery');
try{for(const browser of browsers){const session='atlas-stress-'+browser+'-'+process.pid;try{
 await cli(session,'open',server.url+'/clinical.html#stress-section','--browser',browser);await cli(session,'snapshot');
 const text=await cli(session,'run-code',`async page=>{
 const assert=(v,m)=>{if(!v)throw Error(m);};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.getElementById('stress-run').disabled);
 await ready();await page.locator('#beat-threshold').fill('0.4');assert(await page.locator('#stress-run').isDisabled(),'Pending detector settings accepted');
 await page.locator('#beat-refractory').fill('300');await page.locator('#beat-tolerance').fill('50');await page.locator('#beat-run').click();await ready();
 await page.locator('#stress-run').click();await page.locator('#stress-cancel').click();assert(await page.locator('#stress-json').isDisabled(),'Partial export enabled');
 await page.context().setOffline(true);await page.locator('#stress-run').click();await page.waitForFunction(()=>document.getElementById('stress-status').textContent.startsWith('Sweep complete'));await page.context().setOffline(false);
 assert(await page.locator('#stress-map tr').count()===12,'Lead coverage');assert(await page.locator('#stress-map a').count()===72,'Cutoff coverage');
 assert(await page.locator('#stress-map tr').first().locator('a').first().innerText()==='0','Identity unmatched');
 await page.locator('#stress-record').selectOption('patient002/s0015lre');await page.locator('#stress-metric').selectOption('shift');
 assert((await page.locator('#stress-scale').innerText()).startsWith('Absolute median adjusted shift (ms)'),'Map units');
 const href=await page.locator('#stress-map a').first().getAttribute('href');assert(href.includes('#v2/'),'Incomplete drilldown link');
 const popupPromise=page.waitForEvent('popup');await page.locator('#stress-map a').first().click();const popup=await popupPromise;
 await popup.waitForFunction(()=>document.getElementById('beat-status').textContent.startsWith('Detection comparison complete'));
 assert(await popup.locator('#beat-threshold').inputValue()==='0.4'&&await popup.locator('#beat-refractory').inputValue()==='300'&&await popup.locator('#beat-tolerance').inputValue()==='50','Detector settings lost');
 assert(await popup.locator('#record').inputValue()==='patient002/s0015lre'&&await popup.locator('#lead').inputValue()==='i'&&await popup.locator('#cutoff_hz').inputValue()==='0','Processing settings lost');
 let download=popup.waitForEvent('download');await popup.locator('#beat-json').click();await(await download).saveAs('${output}/${browser}-stress-row.json');
 await popup.locator('#beat-share').click();const shared=popup.url();assert(shared.includes('#v2/'),'Share format');await popup.reload();await popup.waitForFunction(()=>document.getElementById('beat-status').textContent.startsWith('Detection comparison complete'));assert(await popup.locator('#beat-threshold').inputValue()==='0.4','Reload lost detector settings');await popup.close();
 download=page.waitForEvent('download');await page.locator('#stress-json').click();await(await download).saveAs('${output}/${browser}-stress.json');
 download=page.waitForEvent('download');await page.locator('#stress-csv').click();await(await download).saveAs('${output}/${browser}-stress.csv');
 await page.locator('#stress-metric').selectOption('rate');await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:document.getElementById('stress-section').offsetTop-20,behavior:'instant'}));await page.screenshot({path:'${output}/${browser}-stress.png'});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');await page.locator('#stress-results').screenshot({path:'${output}/${browser}-stress-mobile.png'});
 await page.locator('#beat-threshold').fill('0.5');assert(await page.locator('#stress-json').isDisabled(),'Stale sweep export');assert(await page.locator('#stress-results').isHidden(),'Old map still active');
 await page.locator('#beat-run').click();await ready();await page.locator('#stress-run').click();await page.locator('#clip_mv').fill('0.4');assert(await page.locator('#stress-run').isDisabled(),'Processing change did not stop sweep');assert(await page.locator('#stress-json').isDisabled(),'Cancelled export enabled');
 assert(!errors.length,errors.join(';'));return {status:'passed',browser:'${browser}',checks:['216 comparisons','record and metric map','identity','cancel','pending settings','offline','full-setting drilldown','share and reload','JSON/CSV','mobile','mid-run invalidation']};
 }`);
 const r=resultOf(text);if(r.status!=='passed')throw Error(text);
 const d=JSON.parse(await readFile(output+'/'+browser+'-stress.json','utf8')),one=JSON.parse(await readFile(output+'/'+browser+'-stress-row.json','utf8'));
 const row=d.rows.find(r=>r.record===one.analysis.config.record&&r.lead===one.analysis.config.lead&&r.cutoff_hz===one.analysis.config.cutoff_hz);
 for(const [k,v] of Object.entries(row.detection))if(JSON.stringify(v)!==JSON.stringify(one.detection[k]))throw Error('Drilldown detection mismatch: '+k);
 const csv=(await readFile(output+'/'+browser+'-stress.csv','utf8')).trimEnd().split('\n');if(!csv[0].includes('ODC Attribution'))throw Error('CSV source');const lines=csv.filter(l=>!l.startsWith('#'));lines.shift();if(lines.length!==d.rows.length)throw Error('CSV coverage');
 lines.forEach((line,i)=>{const row=d.rows[i],v=row.detection,expected=[row.record,row.lead,row.cutoff_hz,v.recorded_peaks.length,v.output_peaks.length,v.matches.length,v.recorded_only.length,v.output_only.length,...['recorded_rate_bpm','output_rate_bpm','rate_change_bpm','median_shift_ms','median_adjusted_shift_ms'].map(k=>v[k]??'')].join(',');if(line!==expected)throw Error('CSV row mismatch');});
 console.log(JSON.stringify(r));
 }finally{await cli(session,'close').catch(()=>{});}}
}finally{await server.close();}
