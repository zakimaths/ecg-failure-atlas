import {readFile,mkdir} from 'node:fs/promises';
import {cli,localServer,resultOf,output} from './browser-support.mjs';
const browsers=process.argv.slice(2).length?process.argv.slice(2):['chrome','webkit'];
await mkdir(output,{recursive:true});const server=await localServer(process.env.ATLAS_GALLERY||'gallery');
try{for(const browser of browsers){const session='atlas-batch-'+browser+'-'+process.pid;try{
 await cli(session,'open',server.url+'/clinical.html#batch-section','--browser',browser);await cli(session,'snapshot');
 const text=await cli(session,'run-code',`async page=>{
 const assert=(v,m)=>{if(!v)throw Error(m);};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>!document.getElementById('batch-run').disabled);
 await page.getByRole('link',{name:'Batch benchmark',exact:false}).click();await page.waitForFunction(()=>!document.getElementById('batch-run').disabled);await page.locator('#batch-run').click();await page.locator('#batch-cancel').click();assert(await page.locator('#batch-json').isDisabled(),'Partial export enabled');
 await page.locator('#batch-run').click();await page.waitForFunction(()=>document.getElementById('batch-status').textContent.startsWith('Batch complete'));
 assert(await page.locator('#batch-summary tr').count()===18,'Summary coverage');assert(await page.locator('#batch-rows tr').count()===36,'Lead coverage');
 assert(await page.evaluate(()=>document.getElementById('batch-chart').data.every(t=>t.x.length===6&&t.y[0]===0)),'Identity control or plot coverage');
 await page.locator('#batch-cutoff').selectOption('35');
 const link=await page.locator('#batch-rows a').first().getAttribute('href');assert(link.includes('cutoff_hz%22%3A35'),'Drilldown cutoff');
 let promise=page.waitForEvent('download');await page.locator('#batch-json').click();await(await promise).saveAs('${output}/${browser}-batch.json');
 promise=page.waitForEvent('download');await page.locator('#batch-csv').click();await(await promise).saveAs('${output}/${browser}-batch.csv');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:document.getElementById('batch-section').offsetTop-20,behavior:'instant'}));await page.screenshot({path:'${output}/${browser}-batch.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>{const el=document.getElementById('batch-chart');return Math.abs(el.querySelector('.main-svg').getBoundingClientRect().width-el.clientWidth)<2;});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');await page.locator('#batch-chart').screenshot({path:'${output}/${browser}-batch-mobile.png'});
 await page.locator('#clip_mv').fill('0.4');assert(await page.locator('#batch-json').isDisabled(),'Stale export enabled');assert(await page.locator('#batch-run').isDisabled(),'Unapplied settings allowed');
 await page.locator('#run-clinical').click();await page.waitForFunction(()=>!document.getElementById('batch-run').disabled);
 await page.context().setOffline(true);await page.locator('#batch-run').click();await page.waitForFunction(()=>document.getElementById('batch-status').textContent.startsWith('Batch complete'));await page.context().setOffline(false);
 assert(await page.evaluate(()=>document.getElementById('batch-chart').data.some(t=>t.y[0]>0)),'Clipping did not change bypass result');
 assert(!errors.length,errors.join(';'));return {status:'passed',browser:'${browser}',checks:['cancel','216 results','18 summaries','36 displayed rows','identity','cutoff filter','drilldown settings','exports','stale-result protection','mobile','offline']};
 }`);
 const result=resultOf(text);if(result.status!=='passed')throw Error(text);
 const d=JSON.parse(await readFile(output+'/'+browser+'-batch.json','utf8')),csv=(await readFile(output+'/'+browser+'-batch.csv','utf8')).trimEnd().split('\n');
 if(!csv[0].includes('ODC Attribution'))throw Error('CSV attribution');
 const lines=csv.filter(l=>!l.startsWith('#')),header=lines.shift().split(',');if(lines.length!==d.rows.length)throw Error('CSV coverage');
 lines.forEach((line,i)=>{const a=line.split(','),r=d.rows[i];if(a[0]!==r.record||a[1]!==r.lead||+a[2]!==r.cutoff_hz)throw Error('CSV identity');header.slice(6).forEach((key,j)=>{if(+a[j+6]!==r.metrics[key])throw Error('CSV metric');});});
 console.log(JSON.stringify(result));
 }finally{await cli(session,'close').catch(()=>{});}}
}finally{await server.close();}
