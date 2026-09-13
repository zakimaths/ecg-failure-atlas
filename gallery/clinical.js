'use strict';
(async()=>{
  const E=ECGClinical,data=ECG_RECORDINGS,$=id=>document.getElementById(id),leads=['i','ii','iii','avr','avl','avf','v1','v2','v3','v4','v5','v6'];
  const tok=name=>getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim();
  const fmt=v=>v===0?'0':v.toFixed(4),exports=['clinical-json','clinical-csv','clinical-share'];
  let result=null,difference=false,busy=false,pending=false;
  const motion=ECGProcessMotion.mount($('applied-settings'));
  for(const r of data.records){const o=document.createElement('option');o.value=r.id;o.textContent=r.id;$('record').append(o);}
  for(const lead of leads){const o=document.createElement('option');o.value=lead;o.textContent=lead.toUpperCase();$('lead').append(o);}
  function form(c){Object.keys(E.defaults).forEach(k=>{$(k).value=c[k];});}
  function read(){const c=Object.fromEntries(Object.keys(E.defaults).map(k=>[k,['record','lead','mode'].includes(k)?$(k).value:Number($(k).value)]));E.validate(c,data);return c;}
  function status(message,error=false){$('clinical-status').textContent=message;$('clinical-status').dataset.state=error?'error':'ready';}
  function freeze(on){busy=on;document.querySelectorAll('#clinical-form input,#clinical-form select,#run-clinical,#lead-rows button,#clinical-sweep button,#clinical-import').forEach(el=>{el.disabled=on;});exports.forEach(id=>{$(id).disabled=on||pending||!result;});}
  function mark(){window.dispatchEvent(new Event("clinical-pending"));motion.invalidate();pending=true;exports.forEach(id=>{$(id).disabled=true;});status('Settings changed. Run analysis to update the displayed result.');}
  async function plot(){
    if(!result)return;const a=result.arrays,x=a.recorded.map((_,i)=>i/1000);
    const curves=difference?[{name:'Processed − recorded',y:a.output.map((v,i)=>v-a.recorded[i]),color:tok('output')}]:[{name:'Recorded',y:a.recorded,color:tok('reference')},{name:'Processed',y:a.output,color:tok('output')}];
    $('record-overlay').setAttribute('aria-pressed',!difference);$('record-difference').setAttribute('aria-pressed',difference);
    await Plotly.react($('clinical-chart'),curves.map(c=>({type:'scatter',mode:'lines',x,y:c.y,name:c.name,line:{width:1.5,color:c.color},hovertemplate:'%{x:.3f} s<br>%{y:.5f} mV<extra>%{fullData.name}</extra>'})),{paper_bgcolor:tok('surface'),plot_bgcolor:tok('surface'),font:{family:tok('font-body'),size:11,color:tok('muted')},margin:{l:65,r:20,t:65,b:60},xaxis:{title:{text:'Time from segment start (s)'},range:[1,4],gridcolor:tok('grid'),zerolinecolor:tok('control')},yaxis:{title:{text:difference?'Change (mV)':'Amplitude (mV)'},gridcolor:tok('grid'),zerolinecolor:tok('control'),automargin:true},legend:{orientation:'h',x:0,y:1.04,yanchor:'bottom'},hovermode:'x',uirevision:JSON.stringify(result.config)+difference},{responsive:true,displayModeBar:false});
  }
  function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
  function row(target,label,c,values,current){const tr=document.createElement('tr');tr.dataset.current=current;const td=cell(tr,''),button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>{if(!busy){form(c);run(c);}});td.append(button);values.forEach(v=>cell(tr,fmt(v)));target.append(tr);}
  async function run(c){
    if(busy)return;window.dispatchEvent(new Event('clinical-pending'));motion.invalidate();freeze(true);status('Calculating lead and cutoff comparisons…');
    try{
      const next=E.evaluate(c,data);result=next;pending=false;form(c);
      $('clinical-results').hidden=false;$('record-heading').textContent=c.record+' · '+c.lead.toUpperCase();
      $('applied-settings').textContent=`Applied: ${c.cutoff_hz?c.cutoff_hz+' Hz low-pass':'filter bypass'} · ${next.coefficients.length} taps · ${c.mode} · ${c.clip_mv?'±'+c.clip_mv+' mV clipping':'clipping bypass'} · 8,000 samples`;
      $('clinical-metrics').replaceChildren();
      for(const [label,key,unit] of [['RMS change','rms_change_mv','mV'],['Delay-adjusted RMS','aligned_rms_change_mv','mV'],['Largest change','max_abs_change_mv','mV'],['Declared FIR delay','filter_delay_ms','ms']]){const el=document.createElement('article');el.className='metric';const h=document.createElement('h3');h.textContent=label;const p=document.createElement('div');p.className='metric-value';p.textContent=(unit==='ms'?next.metrics[key]:fmt(next.metrics[key]));const u=document.createElement('span');u.textContent=unit;p.append(u);el.append(h,p);$('clinical-metrics').append(el);}
      $('lead-rows').replaceChildren();for(const lead of leads){const config={...c,lead},m=E.evaluate(config,data).metrics;row($('lead-rows'),lead.toUpperCase(),config,[m.rms_change_mv,m.aligned_rms_change_mv,m.recorded_p2p_mv,m.processed_p2p_mv],lead===c.lead);}
      $('clinical-sweep').replaceChildren();for(const cutoff_hz of [...new Set([0,5,12,20,35,50,100,c.cutoff_hz])].sort((a,b)=>a-b)){const config={...c,cutoff_hz},m=E.evaluate(config,data).metrics;row($('clinical-sweep'),cutoff_hz?cutoff_hz+' Hz':'Bypass',config,[m.rms_change_mv,m.aligned_rms_change_mv,m.max_abs_change_mv],cutoff_hz===c.cutoff_hz);}
      await plot();motion.update({input:next.arrays.recorded,output:next.arrays.output,config:c,fs:1000});history.replaceState(null,'','#v1/'+encodeURIComponent(JSON.stringify(c)));status('Analysis complete · 12 leads · '+$('clinical-sweep').children.length+' cutoff settings');$('clinical-export-status').textContent='';window.dispatchEvent(new CustomEvent('clinical-result',{detail:c}));window.dispatchEvent(new CustomEvent('clinical-samples',{detail:next}));
    }catch(error){pending=true;status(error.message,true);}finally{freeze(false);}
  }
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  $('clinical-form').addEventListener('input',mark);$('clinical-form').addEventListener('change',mark);
  $('clinical-form').addEventListener('submit',event=>{event.preventDefault();try{run(read());}catch(error){status(error.message,true);}});
  $('record-overlay').onclick=()=>{difference=false;plot();};$('record-difference').onclick=()=>{difference=true;plot();};
  $('clinical-json').onclick=()=>{if(result&&!pending)download('ecg-clinical-analysis.json',JSON.stringify(result)+'\n','application/json');};
  $('clinical-csv').onclick=()=>{if(!result||pending)return;const s=result.source;let csv='# '+s.attribution+'\n# Source: '+s.source_url+'; license: '+s.license_url+'\n# Record: '+s.record+'; lead: '+s.lead+'; units: mV\n# Settings: '+JSON.stringify(result.config)+'\n# Download analysis JSON for checksums and replay metadata.\ntime_s,recorded_mv,processed_mv,change_mv\n';result.arrays.recorded.forEach((v,i)=>{const y=result.arrays.output[i];csv+=[i/1000,v,y,y-v].join(',')+'\n';});download('ecg-clinical-samples.csv',csv,'text/csv');};
  $('clinical-share').onclick=async()=>{if(!result||pending)return;const url=new URL(location.href);url.hash='v1/'+encodeURIComponent(JSON.stringify(result.config));history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);$('clinical-export-status').textContent='Analysis link copied.';}catch{$('clinical-export-status').textContent='Copy the analysis link from the address bar.';}};
  $('clinical-import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file||busy)return;try{if(file.size>2000000)throw Error('Analysis JSON must be smaller than 2 MB.');const doc=JSON.parse(await file.text());E.replay(doc,data);await run(doc.config);$('clinical-import-status').textContent='Replay passed: pinned source, samples, coefficients and measurements agree.';}catch(error){$('clinical-import-status').textContent='Replay rejected: '+error.message;}finally{event.target.value='';}});
  for(const r of data.records){const p=document.createElement('p');p.textContent=r.id+' · ';for(const [ext,info] of Object.entries(r.files)){const a=document.createElement('a');a.href=info.url;a.textContent=ext.toUpperCase()+' source';a.target='_blank';a.rel='noopener';p.append(a,document.createTextNode(' '));}$('source-files').append(p);}
  const observer=new ResizeObserver(()=>{if(result)Plotly.Plots.resize($('clinical-chart'));});observer.observe($('clinical-chart'));
  async function route(){if(busy)return;try{const hash=location.hash.slice(1),sectionAnchor=['batch-section','beat-section'].includes(hash);if(sectionAnchor&&result){$(hash).scrollIntoView({behavior:'instant'});return;}if(hash&&!sectionAnchor&&(!hash.startsWith('v1/')||hash.length>2048))throw Error('Invalid analysis link.');const c=hash&&!sectionAnchor?JSON.parse(decodeURIComponent(hash.slice(3))):{...E.defaults};E.validate(c,data);form(c);await run(c);if(sectionAnchor)$(hash).scrollIntoView({behavior:'instant'});}catch(error){form(E.defaults);status(error.message+' Select settings and run analysis.',true);}}
  window.addEventListener('hashchange',route);await route();
})();
