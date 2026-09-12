async page => {
  const caption = async text => {
    await page.evaluate(text => {
      let node=document.getElementById('recording-caption');
      if(!node){node=document.createElement('div');node.id='recording-caption';node.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:13px 24px;border:1px solid #63785d;border-radius:0;background:#192019;color:#e8ebdd;font:400 15px monospace;box-shadow:3px 3px 0 #000;max-width:90%;text-align:center;pointer-events:none';document.body.append(node);}
      node.textContent=text;
    },text);
  };
  // These pauses give viewers reading time in the recording; they are not test synchronization.
  const hold = ms => page.waitForTimeout(ms);
  await caption('ECG Failure Atlas · five controlled signal experiments');
  await hold(3500);
  await page.locator('.intro').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.getByRole('radio',{name:'Clipping limit: 0.4 mV',exact:true}).check();
  await caption('A lower clipping limit removes more of the peak.');
  await hold(4500);
  await page.getByRole('radio',{name:'Clipping limit: 0.9 mV',exact:true}).check();
  await caption('Compare the measured amplitude loss at each setting.');
  await hold(4000);
  await page.getByRole('link',{name:'02 Timing delay',exact:true}).click();
  await caption('Five samples at 500 Hz: the same shape, 10 ms late.');
  await hold(4500);
  await page.getByRole('checkbox',{name:'Remove known delay for comparison'}).check();
  await caption('Remove only the known delay. The aligned shape agrees.');
  await hold(4000);
  await page.getByRole('checkbox',{name:'Remove known delay for comparison'}).uncheck();
  await page.locator('.evidence').scrollIntoViewIfNeeded();
  await caption('Download the full inputs, outputs and settings. Replay locally.');
  const pending=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download case',exact:true}).click();
  const download=await pending;
  await download.saveAs(__DEMO_BUNDLE_PATH__);
  await hold(4500);
  await caption('Synthetic engineering references · not a diagnostic tool');
  await hold(3500);
  await page.evaluate(()=>document.getElementById('recording-caption')?.remove());
  return {status:'recorded',bundle:download.suggestedFilename()};
}
