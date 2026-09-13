import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cli,root,output,localServer,resultOf,saveLog} from './browser-support.mjs';
const browsers=process.argv.slice(2).length?process.argv.slice(2):['chrome','webkit'];
if(browsers.some(x=>!['chrome','webkit'].includes(x)))throw Error('Use chrome or webkit');
await mkdir(output,{recursive:true});
await import('../src/ecg_atlas/web/live-engine.js');
const bad=ECGLive.evaluate(ECGLive.defaults);bad.arrays.output[1000]+=.01;
const invalidFile=resolve(output,'altered-experiment.json');await writeFile(invalidFile,JSON.stringify(bad));
const directory=process.env.ATLAS_GALLERY||'gallery',server=await localServer(directory),results=[];
try{
  for(const browser of browsers){
    const session=`atlas-lab-${browser}-${process.pid}`;
    try{
      console.log('Checking custom experiments in '+browser);
      await cli(session,'open',server.url+'/lab.html','--browser',browser);await cli(session,'snapshot');
      const options={directory:output,prefix:browser,offlineURL:pathToFileURL(resolve(root,directory,'lab.html')).href,invalidFile};
      const code=(await readFile(resolve(root,'scripts/lab-browser-suite.js'),'utf8')).replace('__LAB_OPTIONS__',JSON.stringify(options));
      const text=await cli(session,'run-code',code);await saveLog(browser+'-lab-checks.log',text);const result=resultOf(text);
      if(result.status!=='passed')throw Error(text);
      const document=JSON.parse(await readFile(resolve(output,browser+'-live-experiment.json'),'utf8'));
      ECGLive.replay(document);
      const csv=(await readFile(resolve(output,browser+'-live-samples.csv'),'utf8')).trimEnd().split('\n');
      if(csv.shift()!=='time_s,reference_mv,input_mv,output_mv,processed_clean_mv'||csv.length!==4000)throw Error('Unexpected CSV layout');
      csv.forEach((line,i)=>{const values=line.split(',').map(Number),expected=[i/500,...['reference','input','output','clean'].map(key=>document.arrays[key][i])];if(values.length!==5||values.some((v,j)=>v!==expected[j]))throw Error('CSV samples disagree at row '+i);});
      result.checks.push('all CSV rows match experiment JSON');results.push(result);console.log('PASS '+browser+': custom inputs, sweeps, export, replay, responsive and offline');
    }finally{await cli(session,'close').catch(()=>{});}
  }
  await writeFile(resolve(output,'lab-browser-results.json'),JSON.stringify({node:process.version,platform:process.platform,architecture:process.arch,results},null,2)+'\n');
}finally{await server.close();}
