import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cli,root,output,localServer,resultOf,saveLog} from './browser-support.mjs';
await import('../src/ecg_atlas/web/live-engine.js');await import('../src/ecg_atlas/web/clinical-engine.js');
const data=JSON.parse(await readFile(resolve(root,'src/ecg_atlas/data/ptb-subset.json'),'utf8'));
const browsers=process.argv.slice(2).length?process.argv.slice(2):['chrome','webkit'];
if(browsers.some(b=>!['chrome','webkit'].includes(b)))throw Error('Use chrome or webkit');
await mkdir(output,{recursive:true});
const bad=ECGClinical.evaluate(ECGClinical.defaults,data);bad.source.license='MIT';
const invalidFile=resolve(output,'altered-clinical.json');await writeFile(invalidFile,JSON.stringify(bad));
const server=await localServer(process.env.ATLAS_GALLERY||'gallery'),results=[];
try{for(const browser of browsers){const session=`atlas-clinical-${browser}-${process.pid}`;try{
  console.log('Checking clinical analysis in '+browser);await cli(session,'open',server.url+'/clinical.html','--browser',browser);await cli(session,'snapshot');
  const options={directory:output,prefix:browser,invalidFile},code=(await readFile(resolve(root,'scripts/clinical-browser-suite.js'),'utf8')).replace('__CLINICAL_OPTIONS__',JSON.stringify(options));
  const text=await cli(session,'run-code',code);await saveLog(browser+'-clinical-checks.log',text);const result=resultOf(text);if(result.status!=='passed')throw Error(text);
  const doc=JSON.parse(await readFile(resolve(output,browser+'-clinical-analysis.json'),'utf8'));ECGClinical.replay(doc,data);
  const csv=(await readFile(resolve(output,browser+'-clinical-samples.csv'),'utf8')).trimEnd().split('\n');
  if(!csv[0].includes('ODC Attribution')||!csv[1].includes(doc.source.license_url))throw Error('CSV attribution missing');
  const lines=csv.filter(line=>!line.startsWith('#'));if(lines.shift()!=='time_s,recorded_mv,processed_mv,change_mv'||lines.length!==8000)throw Error('CSV layout');
  lines.forEach((line,i)=>{const a=line.split(',').map(Number),x=doc.arrays.recorded[i],y=doc.arrays.output[i],wanted=[i/1000,x,y,y-x];if(a.length!==4||a.some((v,j)=>v!==wanted[j]))throw Error('CSV sample mismatch');});
  results.push(result);console.log('PASS '+browser+': clinical analysis, source attribution and replay exports');
}finally{await cli(session,'close').catch(()=>{});}}
await writeFile(resolve(output,'clinical-browser-results.json'),JSON.stringify({results},null,2)+'\n');
}finally{await server.close();}
