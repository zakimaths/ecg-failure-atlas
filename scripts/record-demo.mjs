import {mkdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cli, root, output, localServer, resultOf, saveLog} from './browser-support.mjs';

await mkdir(output,{recursive:true});
const server=await localServer();
const session=`atlas-record-${process.pid}`;
let recording=false;
try {
  await cli(session,'open',server.url,'--browser','chrome');
  await cli(session,'resize','1440','1000');
  await cli(session,'snapshot');
  await cli(session,'run-code','async page => {await page.waitForFunction(()=>document.getElementById("chart").data?.length===2); return "ready";}');
  await cli(session,'video-start',resolve(output,'ecg-failure-atlas-demo.webm'),'--size','1440x1000');
  recording=true;
  const script=(await readFile(resolve(root,'scripts/demo-scenes.js'),'utf8')).replace('__DEMO_BUNDLE_PATH__',JSON.stringify(resolve(output,'demo-case.zip')));
  const text=await cli(session,'run-code',script);
  await saveLog('demo-recording.log',text);
  if(resultOf(text).status!=='recorded') throw new Error(text);
  console.log(await cli(session,'video-stop'));
  recording=false;
  console.log('Recorded actual interactions and a replay bundle in output/playwright.');
} finally {
  if(recording) await cli(session,'video-stop').catch(()=>{});
  await cli(session,'close').catch(()=>{});
  await server.close();
}
