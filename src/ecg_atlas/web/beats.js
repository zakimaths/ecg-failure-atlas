'use strict';
(() => {
 const $=id=>document.getElementById(id),E=ECGBeats;let analysis=null,result=null,busy=false,revision=0,view='wave',pending=true;
 const fmt=v=>v===null?'Unavailable':Number(v.toFixed(2)).toString();
 function lock(value){['beat-json','beat-csv','beat-share'].forEach(id=>{$(id).disabled=value;});}
 function settings(){const c={threshold_ratio:Number($('beat-threshold').value),refractory_ms:Number($('beat-refractory').value),match_ms:Number($('beat-tolerance').value)};E.validate(c);return c;}
 function dirty(message){window.dispatchEvent(new Event('detector-pending'));revision++;pending=true;lock(true);$('beat-status').textContent=message;}
 window.addEventListener('clinical-pending',()=>{analysis=null;dirty('Run analysis to update detections.');$('beat-run').disabled=true;});
 window.addEventListener('detector-restore',event=>{for(const [key,id] of [['threshold_ratio','beat-threshold'],['refractory_ms','beat-refractory'],['match_ms','beat-tolerance']])$(id).value=event.detail[key];});
 window.addEventListener('clinical-samples',event=>{analysis=event.detail;compare();});
 function appendRow(values){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('beat-rows').append(tr);}
 function tableRows(d){return [...d.matches.map(p=>({kind:'Matched',r:p.recorded_sample,o:p.output_sample,shift:p.shift_ms,adjusted:p.adjusted_shift_ms})),...d.recorded_only.map(p=>({kind:'Recorded only',r:p,o:null,shift:null,adjusted:null})),...d.output_only.map(p=>({kind:'Processed only',r:null,o:p,shift:null,adjusted:null}))].sort((a,b)=>(a.r??a.o)-(b.r??b.o));}
 async function plot(){
  if(!result)return;const a=result.analysis.arrays,d=result.detection,x=a.recorded.map((_,i)=>i/1000),token=k=>getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim();
  const trace=(name,y,color)=>({x,y,name,type:'scatter',mode:'lines',line:{color,width:1.3}}),colors=[token('reference'),token('output')];
  let traces;
  if(view==='score')traces=[trace('Recorded score',d.recorded_score_units.map(v=>v*1e-12),colors[0]),trace('Processed score',d.output_score_units.map(v=>v*1e-12),colors[1]),{x:[1,7],y:[d.threshold_score_units*1e-12,d.threshold_score_units*1e-12],name:'Shared threshold',type:'scatter',mode:'lines',line:{color:token('muted'),dash:'dot',width:1}}];
  else{
   traces=[trace('Recorded',a.recorded,colors[0]),trace('Processed',a.output,colors[1])];
   for(const [key,values,signal,color,symbol] of [['recorded',d.recorded_peaks,a.recorded,colors[0],'circle-open'],['processed',d.output_peaks,a.output,colors[1],'x']])traces.push({x:values.map(i=>i/1000),y:values.map(i=>signal[i]),name:key+' candidates',type:'scatter',mode:'markers',marker:{color,symbol,size:9,line:{width:2}},hovertemplate:'%{x:.3f} s<br>%{y:.5f} mV<extra>%{fullData.name}</extra>'});
  }
  $('beat-wave').setAttribute('aria-pressed',view==='wave');$('beat-energy').setAttribute('aria-pressed',view==='score');
  await Plotly.react($('beat-chart'),traces,{paper_bgcolor:token('surface'),plot_bgcolor:token('surface'),font:{family:token('font-body'),size:10,color:token('muted')},margin:{l:65,r:20,t:$('beat-chart').clientWidth<560?125:75,b:60},xaxis:{title:{text:'Time (s)'},range:[1,7],gridcolor:token('grid')},yaxis:{title:{text:view==='score'?'Slope energy (mV²)':'Amplitude (mV)'},gridcolor:token('grid'),automargin:true},legend:{orientation:'h',x:0,y:1.03,yanchor:'bottom'},uirevision:JSON.stringify(result.analysis.config)+view},{responsive:true,displayModeBar:false});
 }
 async function compare(){
  if(!analysis)return;const token=++revision;pending=true;busy=true;lock(true);$('beat-run').disabled=true;
  try{
   const c=settings(),next=E.evaluate(analysis,c);result=next;$('beat-results').hidden=false;
   $('beat-applied').textContent=`${analysis.config.record} · ${analysis.config.lead.toUpperCase()} · threshold ${c.threshold_ratio} × recorded maximum · minimum spacing ${c.refractory_ms} ms · matching ±${c.match_ms} ms · declared FIR delay ${analysis.metrics.filter_delay_ms} ms`;
   const d=next.detection;$('beat-metrics').replaceChildren();
   for(const [label,value] of [['Matched candidates',d.matches.length],['Recorded only',d.recorded_only.length],['Processed only',d.output_only.length],['Median adjusted shift (ms)',fmt(d.median_adjusted_shift_ms)]]){const el=document.createElement('article');el.className='metric';const h=document.createElement('h3');h.textContent=label;const v=document.createElement('div');v.className='metric-value';v.textContent=value;el.append(h,v);$('beat-metrics').append(el);}
   $('beat-rates').textContent=`Detected candidates: ${d.recorded_peaks.length} recorded / ${d.output_peaks.length} processed. Estimated rates: ${fmt(d.recorded_rate_bpm)} / ${fmt(d.output_rate_bpm)} bpm. Rate change: ${fmt(d.rate_change_bpm)} bpm. Median raw shift: ${fmt(d.median_shift_ms)} ms.`;
   $('beat-rows').replaceChildren();for(const row of tableRows(d))appendRow([row.kind,row.r===null?'N/A':(row.r/1000).toFixed(3),row.o===null?'N/A':(row.o/1000).toFixed(3),row.shift===null?'N/A':row.shift,row.adjusted===null?'N/A':row.adjusted]);
   await plot();if(token!==revision)return;pending=false;lock(false);$('beat-status').textContent='Detection comparison complete.';window.dispatchEvent(new CustomEvent('detector-result',{detail:{analysis:next.analysis.config,detector:c}}));
  }catch(error){if(token===revision)$('beat-status').textContent='Detection comparison failed: '+error.message;}
  finally{busy=false;$('beat-run').disabled=!analysis;}
 }
 $('beat-form').addEventListener('input',()=>dirty('Settings changed. Select Compare detections.'));
 $('beat-form').addEventListener('submit',e=>{e.preventDefault();if(!busy)compare();});
 $('beat-wave').onclick=()=>{view='wave';plot();};$('beat-energy').onclick=()=>{view='score';plot();};
 function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
 $('beat-json').onclick=()=>{if(result&&!pending)download('ecg-detection.json',JSON.stringify(result)+'\n','application/json');};
 $('beat-share').onclick=async()=>{if(!result||pending)return;const url=new URL(location.href);url.hash=ECGClinicalLinks.encode(result.analysis.config,result.detector);history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);$('beat-status').textContent='Comparison link copied.';}catch{$('beat-status').textContent='Copy the comparison link from the address bar.';}};
 $('beat-csv').onclick=()=>{if(!result||pending)return;const s=result.analysis.source,lines=['# '+s.attribution,'# Source: '+s.source_url+'; license: '+s.license_url,'# Processing: '+JSON.stringify(result.analysis.config),'# Detector: '+JSON.stringify(result.detector),'# Candidate differences, not annotated accuracy. Indices at 1000 Hz. JSON provides full replay evidence.','comparison,recorded_sample,output_sample,shift_ms,adjusted_shift_ms'];for(const r of tableRows(result.detection))lines.push([r.kind,r.r??'',r.o??'',r.shift??'',r.adjusted??''].join(','));download('ecg-detection-events.csv',lines.join('\n')+'\n','text/csv');};
 new ResizeObserver(()=>{if($('beat-chart').data){Plotly.relayout($('beat-chart'),{'margin.t':$('beat-chart').clientWidth<560?125:75});Plotly.Plots.resize($('beat-chart'));}}).observe($('beat-chart'));
})();
