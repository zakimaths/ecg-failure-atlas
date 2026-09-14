'use strict';
(() => {
  const $=id=>document.getElementById(id),E=ECGStress,data=ECG_RECORDINGS;
  let config=null,result=null,revision=0,busy=false;
  const names={unmatched:'Unmatched candidates',matched:'Matched candidates',shift:'Absolute median adjusted shift (ms)',rate:'Absolute rate change (bpm)'};
  const fmt=v=>v===null?'N/A':Number(v.toFixed(2)).toString();
  function lock(on){$('stress-json').disabled=on;$('stress-csv').disabled=on;}
  function cancel(message){revision++;busy=false;lock(true);$('stress-run').disabled=!config;$('stress-cancel').hidden=true;$('stress-progress').hidden=true;$('stress-results').hidden=true;$('stress-status').textContent=message;}
  window.addEventListener('detector-pending',()=>{config=null;cancel('Update the detection comparison to run a sweep.');});
  window.addEventListener('clinical-pending',()=>{config=null;cancel('Run analysis to update the sweep settings.');});
  window.addEventListener('detector-result',event=>{
    const {analysis:a,detector}=event.detail;
    config={processing:{clip_mv:a.clip_mv,taps:a.taps,mode:a.mode,cutoffs_hz:[...new Set([0,12,20,35,50,100,a.cutoff_hz])].sort((x,y)=>x-y)},detector:{...detector}};
    cancel('Ready to sweep 36 leads.');
    $('stress-protocol').textContent=`${config.processing.cutoffs_hz.length} cutoffs · ${a.clip_mv?'±'+a.clip_mv+' mV clipping':'no clipping'} · ${a.taps} taps · ${a.mode} · threshold ${detector.threshold_ratio} · spacing ${detector.refractory_ms} ms · matching ±${detector.match_ms} ms`;
  });
  for(const r of data.records){const o=document.createElement('option');o.value=r.id;o.textContent=r.id;$('stress-record').append(o);}
  function renderMap(){
    if(!result)return;
    const metric=$('stress-metric').value,c=result.config.processing,record=$('stress-record').value;
    const values=result.rows.map(r=>E.value(r.detection,metric)).filter(v=>v!==null),max=Math.max(0,...values);
    $('stress-scale').textContent=names[metric]+(max?` · colour range 0 to ${fmt(max)} across all recordings.`:' · all available values are 0.')+(values.length<result.rows.length?' N/A means too few detections to calculate the value.':'');
    $('stress-head').replaceChildren();const head=document.createElement('tr');
    for(const title of ['Lead',...c.cutoffs_hz.map(v=>v?v+' Hz':'Bypass')]){const th=document.createElement('th');th.scope='col';th.textContent=title;head.append(th);}$('stress-head').append(head);
    $('stress-map').replaceChildren();
    for(const lead of result.leads){
      const tr=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=lead.toUpperCase();tr.append(th);
      for(const cutoff_hz of c.cutoffs_hz){
        const r=result.rows.find(r=>r.record===record&&r.lead===lead&&r.cutoff_hz===cutoff_hz),value=E.value(r.detection,metric),td=document.createElement('td'),link=document.createElement('a');
        const analysis={record,lead,cutoff_hz,clip_mv:c.clip_mv,taps:c.taps,mode:c.mode};
        link.href='clinical.html'+ECGClinicalLinks.encode(analysis,result.config.detector);link.target='_blank';link.rel='noopener';link.textContent=fmt(value);
        link.setAttribute('aria-label',`${record}, ${lead.toUpperCase()}, ${cutoff_hz} Hz: ${names[metric]} ${fmt(value)}. Open comparison in a new tab.`);
        link.style.backgroundColor=value===null?'transparent':`rgb(51 255 0 / ${max ? .03+.22*value/max : .03})`;
        link.dataset.missing=value===null;td.append(link);tr.append(td);
      }
      $('stress-map').append(tr);
    }
  }
  $('stress-metric').onchange=renderMap;$('stress-record').onchange=renderMap;
  $('stress-run').onclick=async()=>{
    if(!config||busy)return;cancel('Running detector sweep…');busy=true;const token=revision,protocol=structuredClone(config);
    $('stress-run').disabled=true;$('stress-cancel').hidden=false;$('stress-progress').hidden=false;$('stress-progress').value=0;
    $('stress-progress').max=protocol.processing.cutoffs_hz.length*36;
    try{
      const it=E.calculate(protocol,data);let step;
      do{
        if(token!==revision)return;step=it.next();
        if(!step.done){$('stress-progress').value=step.value.completed;if(step.value.completed===1||step.value.completed%12===0)$('stress-status').textContent=`Calculated ${step.value.completed} / ${step.value.total} comparisons.`;await new Promise(resolve=>setTimeout(resolve,0));}
      }while(!step.done);
      if(token!==revision)return;result=step.value;$('stress-results').hidden=false;renderMap();lock(false);$('stress-status').textContent=`Sweep complete: ${result.rows.length} comparisons.`;
    }catch(error){if(token===revision)$('stress-status').textContent='Sweep failed: '+error.message;}
    finally{if(token===revision){busy=false;$('stress-run').disabled=!config;$('stress-cancel').hidden=true;$('stress-progress').hidden=true;}}
  };
  $('stress-cancel').onclick=()=>cancel('Sweep cancelled. Run again to calculate all results.');
  function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
  $('stress-json').onclick=()=>{if(result&&!$('stress-json').disabled)download('ecg-detector-sweep.json',JSON.stringify(result)+'\n','application/json');};
  $('stress-csv').onclick=()=>{
    if(!result||$('stress-csv').disabled)return;
    const fields=['recorded_rate_bpm','output_rate_bpm','rate_change_bpm','median_shift_ms','median_adjusted_shift_ms'];
    const lines=['# '+result.source.attribution,'# Source: '+result.source.source_url+'; license: '+result.source.license_url,'# Settings: '+JSON.stringify(result.config),'# Candidate comparisons in [1,7) seconds. Empty fields mean unavailable. JSON contains full replay evidence.',['record','lead','cutoff_hz','recorded_count','processed_count','matched_count','recorded_only_count','processed_only_count',...fields].join(',')];
    for(const r of result.rows){const d=r.detection;lines.push([r.record,r.lead,r.cutoff_hz,d.recorded_peaks.length,d.output_peaks.length,d.matches.length,d.recorded_only.length,d.output_only.length,...fields.map(k=>d[k]??'')].join(','));}
    download('ecg-detector-sweep.csv',lines.join('\n')+'\n','text/csv');
  };
})();
