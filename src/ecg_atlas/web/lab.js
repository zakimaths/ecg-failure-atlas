'use strict';
(() => {
  const E=ECGLive, $=id=>document.getElementById(id);
  const token=name=>getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim();
  const colors={reference:token('reference'),input:token('muted'),output:token('output'),clean:token('secondary')};
  const plotConfig={responsive:true,displayModeBar:false,scrollZoom:false};
  let result=null, sweep=[], view='wave', responseView='magnitude', whole=false, pending=false, busy=false, queued=null;
  const fmt=(v,digits=4)=>Math.abs(v)<1e-13 ? '0' : new Intl.NumberFormat('en-GB',{maximumFractionDigits:digits}).format(v);
  const scientific=v=>Math.abs(v)<1e-15 ? '0' : v.toExponential(5);
  const presets={
    noise:{...E.defaults},
    clip:{...E.defaults,noise_mv:0,clip_mv:.4,cutoff_hz:35},
    delay:{...E.defaults,noise_mv:0,mode:'causal'},
    identity:{...E.defaults,noise_mv:0,cutoff_hz:0}
  };
  const exportButtons=['save-experiment','save-csv','share-experiment'];
  const motion=ECGProcessMotion.mount($('pipeline-note'));
  function setForm(config){for(const key of Object.keys(E.defaults))$(key).value=config[key];}
  function readForm(){return E.validate(Object.fromEntries(Object.keys(E.defaults).map(k=>[k,k==='mode'?$(k).value:Number($(k).value)])));}
  function freeze(value){
    busy=value;
    document.querySelectorAll('#experiment-form input,#experiment-form select,.lab-presets button,#run,#import-experiment,#sweep-rows button').forEach(el=>{el.disabled=value;});
    exportButtons.forEach(id=>{$(id).disabled=value||pending||!result;});
  }
  function markPending(){
    motion.invalidate();
    pending=true;$('run-status').textContent='Settings changed. Run to update the measurements below.';$('run-status').dataset.state='pending';
    $('export-status').textContent='Run the changed settings before exporting.';exportButtons.forEach(id=>{$(id).disabled=true;});
  }
  function baseLayout(title){return {paper_bgcolor:token('surface'),plot_bgcolor:token('surface'),font:{family:token('font-body'),color:token('muted'),size:11},margin:{l:68,r:24,t:20,b:70},xaxis:{title:{text:title},gridcolor:token('grid'),zerolinecolor:token('control'),automargin:true},yaxis:{gridcolor:token('grid'),zerolinecolor:token('control'),automargin:true},legend:{orientation:'h',x:0,y:1.04,yanchor:'bottom',font:{size:11}},hovermode:'x',hoverlabel:{bgcolor:token('raised'),font:{color:token('ink')}}};}
  async function plotSignal(){
    if(!result)return;
    const x=Array.from({length:E.N},(_,i)=>i/E.FS),a=result.arrays;
    const curves=view==='wave' ? [
      {y:a.reference,name:'Reference',color:colors.reference},
      {y:a.input,name:'Corrupted input',color:colors.input},
      {y:a.output,name:'Processed input',color:colors.output},
      {y:a.clean,name:'Clean input, processed',color:colors.clean,dash:'dot'}
    ] : [
      {y:a.output.map((v,i)=>v-a.reference[i]),name:'Total error',color:colors.output},
      {y:a.clean.map((v,i)=>v-a.reference[i]),name:'Processing distortion (d)',color:colors.clean},
      {y:a.output.map((v,i)=>v-a.clean[i]),name:'Corruption effect (e)',color:colors.reference,dash:'dot'}
    ];
    const layout=baseLayout('Time (s)');layout.xaxis.range=whole?[0,8]:[3.35,4.2];layout.yaxis.title={text:view==='wave'?'Amplitude (mV)':'Error (mV)'};
    layout.margin.t=$('lab-chart').clientWidth<560?115:65;layout.uirevision=view+'-'+whole;
    $('wave-view').setAttribute('aria-pressed',view==='wave');$('error-view').setAttribute('aria-pressed',view==='error');
    $('plot-heading').textContent=view==='wave'?'Reference and processed signals':'Total error = processing distortion + corruption effect';
    $('full-record').textContent=whole?'Focus on one beat':'Show all 8 seconds';
    await Plotly.react($('lab-chart'),curves.map(c=>({x,y:c.y,name:c.name,type:'scatter',mode:'lines',line:{color:c.color,width:c.name==='Corrupted input'?1:1.8,dash:c.dash||'solid'},hovertemplate:'%{x:.3f} s<br>%{y:.5f} mV<extra>%{fullData.name}</extra>'})),layout,plotConfig);
  }
  async function plotResponse(){
    if(!result)return;
    const x=Array.from({length:501},(_,i)=>i*.5),h=E.response(result.coefficients,result.config.mode,x);
    let previous=0,offset=0;
    const phase=h.map((v,i)=>{const angle=Math.atan2(v.imag,v.real);if(i){const jump=angle-previous;if(jump>Math.PI)offset-=2*Math.PI;if(jump<-Math.PI)offset+=2*Math.PI;}previous=angle;return v.magnitude>.001 ? (angle+offset)*180/Math.PI : null;});
    const magnitude=h.map(v=>20*Math.log10(Math.max(1e-5,v.magnitude)));
    const layout=baseLayout('Frequency (Hz)');layout.xaxis.range=[0,100];layout.yaxis.title={text:responseView==='magnitude'?'Gain (dB)':'Phase (degrees)'};layout.showlegend=false;
    if(responseView==='magnitude')layout.yaxis.range=[-100,5];
    $('magnitude-view').setAttribute('aria-pressed',responseView==='magnitude');$('phase-view').setAttribute('aria-pressed',responseView==='phase');
    await Plotly.react($('response-chart'),[{x,y:responseView==='magnitude'?magnitude:phase,connectgaps:false,type:'scatter',mode:'lines',line:{color:colors.clean,width:2},hovertemplate:responseView==='magnitude'?'%{x:.1f} Hz<br>%{y:.2f} dB<extra>FIR gain</extra>':'%{x:.1f} Hz<br>%{y:.2f}°<extra>FIR phase</extra>'}],layout,plotConfig);
  }
  function metrics(){
    const m=result.metrics;
    $('live-metrics').replaceChildren();
    for(const [label,key,description] of [
      ['Input error','input_rmse_mv','Corrupted input versus the clean reference.'],
      ['Output error','output_rmse_mv','Processed corrupted input versus the clean reference. Timing is not adjusted after processing.'],
      ['Clean signal changed','clean_rmse_mv','The same clipping and filter applied to clean input, compared with the reference.']
    ]) {
      const article=document.createElement('article');article.className='metric';
      const h=document.createElement('h3');h.textContent=label;
      const value=document.createElement('div');value.className='metric-value';value.textContent=fmt(m[key]);
      const unit=document.createElement('span');unit.textContent='mV RMS';value.append(unit);
      const p=document.createElement('p');p.textContent=description;article.append(h,value,p);$('live-metrics').append(article);
    }
    $('landmarks').replaceChildren();
    for(const [label,key,unit] of [['Peak change','peak_change_percent','%'],['Landmark shift','landmark_shift_ms','ms'],['Applied FIR delay','filter_delay_ms','ms']]) {
      const span=document.createElement('span');span.append(document.createTextNode(label+' '));const strong=document.createElement('strong');strong.textContent=fmt(m[key],2)+' '+unit;span.append(strong);$('landmarks').append(span);
    }
    const difference=m.output_rmse_mv-m.input_rmse_mv;
    const assessment=Math.abs(difference)<1e-12 ? 'Processing leaves total RMS error unchanged.' : `Processing ${difference<0?'reduces':'increases'} total RMS error by ${fmt(Math.abs(difference))} mV on this record.`;
    $('comparison-summary').textContent=`${assessment} The clean-input branch changes by ${fmt(m.clean_rmse_mv)} mV RMS; the corruption effect after processing is ${fmt(m.corruption_rmse_mv)} mV RMS.`;
    $('error-identity').textContent=`Mean squared error (mV²): ${scientific(m.total_mse_mv2)} = ${scientific(m.clean_mse_mv2)} + ${scientific(m.corruption_mse_mv2)} + (${scientific(m.cross_term_mv2)} cross term).`;
    const c=result.config;
    $('pipeline-note').textContent=`Reference → uniform noise (seed ${c.seed}) + ${fmt(c.wander_hz,2)} Hz wander → ${c.clip_mv?fmt(c.clip_mv,2)+' mV clipping':'no clipping'} → ${c.cutoff_hz?fmt(c.cutoff_hz,2)+' Hz FIR, '+c.taps+' taps, '+c.mode:'filter bypass'}.`;
    const delay=(result.coefficients.length-1)/2/E.FS*1000;
    const gain=E.response(result.coefficients,c.mode,[c.cutoff_hz])[0].magnitude;
    $('filter-explanation').textContent=c.cutoff_hz ? `The symmetric ${c.taps}-tap FIR has a ${fmt(delay)} ms causal group delay. ${c.mode==='centered'?'This centered comparison uses future samples to remove that delay; it is one convolution, not forward–backward filtering.':'The causal output retains this delay. A shifted waveform contributes to the unaligned error.'} The Hamming-window design has a finite transition band. Gain at ${fmt(c.cutoff_hz)} Hz is ${fmt(20*Math.log10(gain),2)} dB; this cutoff is a nominal half-amplitude design point, not a sharp boundary.` : 'Filtering is bypassed: gain is one and phase is zero at every frequency. Any remaining change comes from corruption or clipping.';
  }
  async function renderSweep(){
    const layout=baseLayout('Low-pass cutoff (Hz; 0 = bypass)');layout.yaxis.title={text:'RMS error (mV)'};layout.margin.t=55;
    const x=sweep.map(r=>r.cutoff_hz);
    await Plotly.react($('sweep-chart'),[['output_rmse_mv','Total output error',colors.output],['clean_rmse_mv','Clean signal changed',colors.clean]].map(([key,name,color])=>({x,y:sweep.map(r=>r[key]),name,type:'scatter',mode:'lines+markers',line:{color,width:2},marker:{size:6},hovertemplate:'%{x} Hz<br>%{y:.5f} mV<extra>%{fullData.name}</extra>'})),layout,plotConfig);
    $('sweep-rows').replaceChildren();
    for(const row of sweep){
      const tr=document.createElement('tr');tr.dataset.current=String(row.cutoff_hz===result.config.cutoff_hz);
      const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent=row.cutoff_hz?`${row.cutoff_hz} Hz`:'Bypass';button.setAttribute('aria-label',`Use ${row.cutoff_hz} Hz cutoff`);
      button.addEventListener('click',()=>{setForm({...result.config,cutoff_hz:row.cutoff_hz});run(readForm());});td.append(button);
      if(row.cutoff_hz===result.config.cutoff_hz){const selected=document.createElement('span');selected.textContent='Current';td.append(selected);}tr.append(td);
      for(const key of ['output_rmse_mv','clean_rmse_mv','corruption_rmse_mv']){const cell=document.createElement('td');cell.textContent=fmt(row[key],5);tr.append(cell);}
      $('sweep-rows').append(tr);
    }
  }
  function encode(config){return '#v1/'+btoa(JSON.stringify(config));}
  function decode(hash){if(!hash.startsWith('#v1/')||hash.length>2048)throw Error('This experiment link has an unsupported format.');return E.validate(JSON.parse(atob(hash.slice(4))));}
  async function run(config,imported=false){
    if(busy){queued={config,imported};return;}
    motion.invalidate();freeze(true);$('run-status').dataset.state='';$('run-status').textContent='Calculating signals, response and cutoff sweep…';
    await new Promise(resolve=>requestAnimationFrame(resolve));
    try{
      result=E.evaluate(config);sweep=E.sweep(config);pending=false;
      history.replaceState(null,'',encode(result.config));$('lab-results').hidden=false;
      metrics();await Promise.all([plotSignal(),plotResponse(),renderSweep()]);
      motion.update({input:result.arrays.input,output:result.arrays.output,config:result.config,fs:E.FS,inputLabel:"Perturbed input"});
      for(const id of ['lab-chart','response-chart','sweep-chart'])Plotly.Plots.resize($(id));
      $('export-status').textContent='';$('run-status').textContent=`Computed 4,000 samples and ${sweep.length} cutoff comparisons. Settings and results agree.`;
      if(imported){$('import-status').dataset.state='';$('import-status').textContent='Replay passed: arrays, coefficients and measurements agree within 1e-10. The saved settings are restored.';}
    }catch(error){pending=true;$('run-status').dataset.state='error';$('run-status').textContent=error.message;}
    finally{freeze(false);if(queued){const next=queued;queued=null;setForm(next.config);run(next.config,next.imported);}}
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('experiment-form').addEventListener('input',markPending);
  $('experiment-form').addEventListener('submit',event=>{event.preventDefault();try{run(readForm());}catch(error){$('run-status').textContent=error.message;$('run-status').dataset.state='error';}});
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{setForm(presets[button.dataset.preset]);run(readForm());}));
  $('wave-view').addEventListener('click',()=>{view='wave';plotSignal();});$('error-view').addEventListener('click',()=>{view='error';plotSignal();});
  $('full-record').addEventListener('click',()=>{whole=!whole;plotSignal();});
  $('magnitude-view').addEventListener('click',()=>{responseView='magnitude';plotResponse();});$('phase-view').addEventListener('click',()=>{responseView='phase';plotResponse();});
  $('save-experiment').addEventListener('click',()=>{if(!pending&&result){download('ecg-experiment.json',JSON.stringify(result)+'\n','application/json');$('export-status').textContent='Experiment JSON downloaded. Use either Python replay mode to check it.';}});
  $('save-csv').addEventListener('click',()=>{if(!pending&&result){const a=result.arrays,rows=['time_s,reference_mv,input_mv,output_mv,processed_clean_mv'];for(let i=0;i<E.N;i++)rows.push([i/E.FS,a.reference[i],a.input[i],a.output[i],a.clean[i]].join(','));download('ecg-samples.csv',rows.join('\n')+'\n','text/csv');$('export-status').textContent='4,000 full-resolution sample rows downloaded. Use the JSON for replay.';}});
  $('share-experiment').addEventListener('click',async()=>{
    if(pending||!result)return;let timeout;
    try{await Promise.race([navigator.clipboard.writeText(location.href),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Unavailable')),1500);})]);$('export-status').textContent='Experiment link copied.';}
    catch(_){$('export-status').textContent='Copy this experiment address: '+location.href;}finally{clearTimeout(timeout);}
  });
  $('import-experiment').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>2000000)throw Error('Choose an experiment JSON smaller than 2 MB.');const document=JSON.parse(await file.text());E.replay(document);setForm(document.config);await run(document.config,true);}
    catch(error){$('import-status').dataset.state='error';$('import-status').textContent='Replay rejected: '+error.message;}
    finally{event.target.value='';}
  });
  document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();$('main').focus();$('main').scrollIntoView();});
  const resize=new ResizeObserver(entries=>{for(const entry of entries)if(entry.target.data){if(entry.target.id==='lab-chart')Plotly.relayout(entry.target,{'margin.t':entry.target.clientWidth<560?115:65});Plotly.Plots.resize(entry.target);}});
  for(const id of ['lab-chart','response-chart','sweep-chart'])resize.observe($(id));
  function fromHash(){try{const config=location.hash?decode(location.hash):{...E.defaults};setForm(config);run(config);}catch(error){setForm(E.defaults);pending=true;freeze(false);$('run-status').dataset.state='error';$('run-status').textContent=error.message+' Choose a processing preset to continue.';}}
  window.addEventListener('hashchange',fromHash);fromHash();
})();
