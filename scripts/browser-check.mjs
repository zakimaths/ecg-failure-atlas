import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cli, root, output, localServer, resultOf, saveLog} from './browser-support.mjs';

await mkdir(output,{recursive:true});
const directory = process.env.ATLAS_GALLERY || 'gallery';
const browsers = process.argv.slice(2).length ? process.argv.slice(2) : ['chrome','webkit'];
if(browsers.some(browser=>!['chrome','webkit'].includes(browser))) throw new Error('Use chrome or webkit');
const server = await localServer(directory);
const results=[];
try {
  for(const browser of browsers) {
    const session = `atlas-check-${browser}-${process.pid}`;
    try {
      console.log(`Checking ${browser} at ${server.url}`);
      await cli(session,'open',server.url,'--browser',browser);
      await cli(session,'snapshot');
      const options={browser,directory:output,outputPrefix:browser,offlineURL:pathToFileURL(resolve(root,directory,'index.html')).href};
      const code=(await readFile(resolve(root,'scripts/browser-suite.js'),'utf8')).replace('__ATLAS_OPTIONS__',JSON.stringify(options));
      console.log(`${browser}: running waveform and interaction checks`);
      const text=await cli(session,'run-code',code);
      await saveLog(`${browser}-checks.log`,text);
      const result=resultOf(text);
      if(result.status!=='passed'||result.variantsChecked!==15) throw new Error(text);
      results.push(result);
      console.log(`PASS ${browser}: 15 variants, 5 differences, keyboard, downloads, responsive and offline checks`);
    } finally {await cli(session,'close').catch(()=>{});}
  }
  await writeFile(resolve(output,'browser-results.json'),JSON.stringify({node:process.version,platform:process.platform,architecture:process.arch,results},null,2)+'\n');
} finally {await server.close();}
