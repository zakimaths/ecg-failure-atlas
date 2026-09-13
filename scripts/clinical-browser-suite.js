async page=>{
  const {directory,prefix,invalidFile}=__CLINICAL_OPTIONS__,assert=(v,m)=>{if(!v)throw Error(m);},errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>document.getElementById('clinical-status').textContent.startsWith('Analysis complete')&&!document.getElementById('run-clinical').disabled);
  await ready();
  for(const record of ['patient001/s0010_re','patient002/s0015lre','patient003/s0017lre']){
    await page.locator('#record').selectOption(record);await page.locator('#lead').selectOption('v2');await page.locator('#mode').selectOption('causal');await page.locator('#run-clinical').click();await ready();
    assert(await page.evaluate(()=>{const config=Object.fromEntries(Object.keys(ECGClinical.defaults).map(k=>[k,['record','lead','mode'].includes(k)?document.getElementById(k).value:Number(document.getElementById(k).value)])),r=ECGClinical.evaluate(config,ECG_RECORDINGS),plot=document.getElementById('clinical-chart');return plot.data[0].y.every((v,i)=>v===r.arrays.recorded[i])&&plot.data[1].y.every((v,i)=>v===r.arrays.output[i])&&document.getElementById('lead-rows').children.length===12;}),'Clinical plot mismatch');
  }
  await page.locator('#cutoff_hz').fill('0');await page.locator('#clip_mv').fill('0');assert(await page.locator('#clinical-json').isDisabled(),'Dirty export enabled');await page.locator('#run-clinical').click();await ready();
  assert(await page.evaluate(()=>document.getElementById('clinical-chart').data[0].y.every((v,i)=>v===document.getElementById('clinical-chart').data[1].y[i])),'Identity changes recorded samples');
  await page.locator('#lead-rows button').filter({hasText:/^II$/}).click();await ready();
  await page.locator('#clinical-sweep button').filter({hasText:/^20 Hz$/}).click();await ready();
  await page.locator('#record-difference').click();await page.waitForFunction(()=>document.getElementById('clinical-chart').data.length===1);
  assert(await page.evaluate(()=>{const c={record:document.getElementById('record').value,lead:'ii',cutoff_hz:20,clip_mv:0,taps:61,mode:'causal'},r=ECGClinical.evaluate(c,ECG_RECORDINGS);return document.getElementById('clinical-chart').data[0].y.every((v,i)=>v===r.arrays.output[i]-r.arrays.recorded[i]);}),'Difference samples mismatch');
  await page.locator('#record-overlay').click();
  let waiting=page.waitForEvent('download');await page.locator('#clinical-json').click();await(await waiting).saveAs(directory+'/'+prefix+'-clinical-analysis.json');
  waiting=page.waitForEvent('download');await page.locator('#clinical-csv').click();await(await waiting).saveAs(directory+'/'+prefix+'-clinical-samples.csv');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}));
  await page.locator('#clinical-share').click();await page.waitForFunction(()=>document.getElementById('clinical-export-status').textContent.includes('address bar'));
  const link=page.url();await page.reload();await ready();assert(await page.locator('#cutoff_hz').inputValue()==='20','Link lost cutoff');
  await page.locator('#clinical-import').setInputFiles(directory+'/'+prefix+'-clinical-analysis.json');await page.waitForFunction(()=>document.getElementById('clinical-import-status').textContent.startsWith('Replay passed'));
  await page.locator('#clinical-import').setInputFiles(invalidFile);await page.waitForFunction(()=>document.getElementById('clinical-import-status').textContent.startsWith('Replay rejected'));assert(page.url()===link,'Tampered import changed URL');
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:directory+'/'+prefix+'-clinical-desktop.png',fullPage:false});
  await page.evaluate(()=>window.scrollTo({top:document.getElementById('record-heading').getBoundingClientRect().top+window.scrollY-35,behavior:'instant'}));await page.screenshot({path:directory+'/'+prefix+'-clinical-result.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>{const el=document.getElementById('clinical-chart'),svg=el.querySelector('.main-svg');return svg&&Math.abs(svg.getBoundingClientRect().width-el.clientWidth)<2;});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:directory+'/'+prefix+'-clinical-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');await page.locator('#clinical-chart').screenshot({path:directory+'/'+prefix+'-clinical-mobile-chart.png'});
  assert(await page.locator('.social-links a').count()===6,'Missing profile links');assert(!(await page.locator('body').innerText()).includes('—'),'Em dash in copy');
  assert(await page.locator('#clinical-source').innerText().then(s=>s.includes('ODC Attribution')&&s.includes('Benjamin Franklin')),'Missing attribution');
  await page.context().setOffline(true);await page.locator('#cutoff_hz').fill('35');await page.locator('#run-clinical').click();await ready();await page.context().setOffline(false);
  assert(errors.length===0,errors.join('\n'));
  return {status:'passed',browser:prefix,checks:['three hospital records','exact plotted samples','identity','12 lead rows','cutoff selection','difference','pending export','JSON/CSV','share reload','clipboard fallback','replay import','tamper rejection','desktop/mobile','attribution','offline calculation'],errors};
}
