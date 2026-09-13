async page => {
  const {directory,prefix,offlineURL,invalidFile}=__LAB_OPTIONS__;
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{const u=r.url();if(/^https?:/.test(u)&&!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u))external.push(u);});
  const assert=(v,message)=>{if(!v)throw Error(message);};
  const ready=()=>page.waitForFunction(()=>document.getElementById('run-status').textContent.startsWith('Computed ')&&!document.getElementById('run').disabled).catch(async error=>{throw Error('Calculation readiness: '+await page.locator('#run-status').innerText()+'; '+error.message);});
  const fit=()=>page.waitForFunction(()=>['lab-chart','response-chart','sweep-chart'].every(id=>{const el=document.getElementById(id),svg=el.querySelector('.main-svg');return svg&&Math.abs(svg.getBoundingClientRect().width-el.clientWidth)<2;}));
  let stage='initial';
  try {
  await ready();
  for(const preset of ['noise','clip','delay','identity']){
    stage='preset '+preset;
    await page.locator(`[data-preset="${preset}"]`).click();await ready();
    assert(await page.evaluate(()=>{
      const config=JSON.parse(atob(location.hash.slice(4))),expected=ECGLive.evaluate(config),chart=document.getElementById('lab-chart');
      return ['reference','input','output','clean'].every((key,i)=>chart.data[i].y.every((v,j)=>v===expected.arrays[key][j]));
    }),preset+' plotted samples disagree');
  }
  assert(await page.locator('#live-metrics .metric-value').allTextContents().then(v=>v.every(x=>x.startsWith('0mV'))),'Identity metric not zero');
  stage='custom settings';
  await page.locator('#noise_mv').fill('0.12');
  assert(await page.locator('#save-experiment').isDisabled(),'Pending settings can be exported');
  for(const [key,value] of Object.entries({seed:'123',wander_mv:'0.2',wander_hz:'0.5',clip_mv:'0.6',cutoff_hz:'12'}))await page.locator('#'+key).fill(value);
  await page.locator('#taps').selectOption('101');await page.locator('#mode').selectOption('causal');
  await page.getByRole('button',{name:'Run experiment',exact:false}).click();await ready();
  stage='error view';
  await page.getByRole('button',{name:'Error components',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('lab-chart').data.length===3);
  assert(await page.evaluate(()=>{const d=document.getElementById('lab-chart').data;return d[0].y.every((v,i)=>Math.abs(v-d[1].y[i]-d[2].y[i])<1e-12);}), 'Error components do not sum to total');
  stage='phase view';
  await page.getByRole('button',{name:'Phase',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('response-chart').layout.yaxis.title.text==='Phase (degrees)');
  stage='sweep';
  await page.getByRole('button',{name:'Use 20 Hz cutoff',exact:true}).click();await ready();
  assert(await page.locator('#cutoff_hz').inputValue()==='20','Sweep setting did not apply');
  stage='download';
  const before=await page.evaluate(()=>location.hash);
  let downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download experiment',exact:true}).click();
  const download=await downloadPromise;const saved=`${directory}/${prefix}-live-experiment.json`;await download.saveAs(saved);
  downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();
  const csv=await downloadPromise;await csv.saveAs(`${directory}/${prefix}-live-samples.csv`);
  stage='reload';
  await page.reload();await ready();assert(await page.evaluate(()=>location.hash)===before,'Shared settings changed after reload');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('Denied'))}}));
  await page.getByRole('button',{name:'Copy experiment link',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('export-status').textContent.startsWith('Copy this experiment address:'));
  await page.locator('[data-preset="identity"]').click();await ready();
  stage='import';
  await page.locator('#import-experiment').setInputFiles(saved);
  await page.waitForFunction(()=>document.getElementById('import-status').textContent.startsWith('Replay passed:'));await ready();
  assert(await page.evaluate(()=>location.hash)===before,'Import did not restore original settings');
  stage='rejected import';
  await page.locator('#import-experiment').setInputFiles(invalidFile);
  await page.waitForFunction(()=>document.getElementById('import-status').textContent.startsWith('Replay rejected:'));
  assert(await page.evaluate(()=>location.hash)===before,'Rejected import replaced current experiment');
  await page.locator('#import-status').evaluate(el=>{el.textContent='';});
  stage='desktop fit';
  await page.setViewportSize({width:1440,height:1000});await fit();await page.evaluate(()=>document.fonts.ready.then(()=>true));
  await page.screenshot({path:`${directory}/${prefix}-lab-desktop.png`,fullPage:true});
  stage='mobile fit';
  await page.setViewportSize({width:390,height:844});await fit();
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile page overflow');
  await page.screenshot({path:`${directory}/${prefix}-lab-mobile.png`,fullPage:true});
  assert(await page.locator('.social-links a').count()===6,'Profile links missing');
  assert(!(await page.locator('body').innerText()).includes('—'),'Visible em dash');
  stage='offline';
  await page.context().setOffline(true);
  if(prefix==='chrome'){await page.goto(offlineURL);await ready();}
  await page.locator('[data-preset="noise"]').click();await ready();
  await page.context().setOffline(false);
  assert(errors.length===0,'Browser errors: '+errors.join(', '));assert(external.length===0,'External requests: '+external.join(', '));
  return {status:'passed',browser:prefix,presets:4,samples:4000,download:saved,checks:['custom settings','pending export disabled','exact plot samples','error decomposition','phase response','cutoff selection','JSON and CSV download','link reload','clipboard fallback','replay import','tamper rejection','mobile fit','offline calculation','profile links','no em dashes'],errors};
  } catch(error) {throw Error(stage+': '+error.message+' | '+await page.locator('#run-status').innerText());}
}
