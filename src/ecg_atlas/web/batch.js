'use strict';
(() => {
  const $=id=>document.getElementById(id),data=ECG_RECORDINGS,E=ECGBatch;
  let config=null,documentResult=null,revision=0,busy=false;
  const fmt=v=>v===0?'0':v.toFixed(5);
  function lock(disabled){['batch-json','batch-csv'].forEach(id=>{$(id).disabled=disabled;});}
  function cancel(message){revision++;busy=false;$('batch-cancel').hidden=true;$('batch-progress').hidden=true;$('batch-run').disabled=!config;lock(true);$('batch-status').textContent=message;}
  window.addEventListener('clinical-pending',()=>{config=null;cancel('Settings changed. Run analysis before rerunning the batch.');});
  window.addEventListener('clinical-result',event=>{
    const c=event.detail;
    cancel('Ready to run all 36 leads.');
    config={clip_mv:c.clip_mv,cutoffs_hz:[...new Set([0,12,20,35,50,100,c.cutoff_hz])].sort((a,b)=>a-b),taps:c.taps,mode:c.mode};
    $('batch-run').disabled=false;
    $('batch-protocol').textContent=`Applied protocol: ${c.clip_mv?'±'+c.clip_mv+' mV clipping':'clipping bypass'} · ${c.taps} taps · ${c.mode} · ${config.cutoffs_hz.length} cutoffs · ${config.cutoffs_hz.length*36} lead-setting results.`;
  });
  function row(target,values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');if(value instanceof Node)td.append(value);else td.textContent=value;tr.append(td);}target.append(tr);}
  function renderRows(){
    $('batch-rows').replaceChildren();if(!documentResult)return;
    const cutoff=Number($('batch-cutoff').value);
    for(const r of documentResult.rows.filter(r=>r.cutoff_hz===cutoff)){
      const link=document.createElement('a');link.textContent=r.record+' / '+r.lead.toUpperCase();
      const c={record:r.record,lead:r.lead,cutoff_hz:r.cutoff_hz,...Object.fromEntries(['clip_mv','taps','mode'].map(k=>[k,documentResult.config[k]]))};
      link.href='clinical.html#v1/'+encodeURIComponent(JSON.stringify(c));link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',link.textContent+' analysis (opens in a new tab)');
      row($('batch-rows'),[link,fmt(r.metrics.rms_change_mv),fmt(r.metrics.aligned_rms_change_mv),fmt(r.metrics.max_abs_change_mv)]);
    }
  }
  async function render(doc){
    $('batch-results').hidden=false;$('batch-summary').replaceChildren();
    for(const r of doc.summaries)row($('batch-summary'),[r.record,r.cutoff_hz?r.cutoff_hz+' Hz':'Bypass',...['mean_rms_change_mv','median_rms_change_mv','min_rms_change_mv','max_rms_change_mv'].map(k=>fmt(r[k]))]);
    $('batch-cutoff').replaceChildren();for(const cutoff of doc.config.cutoffs_hz){const o=document.createElement('option');o.value=cutoff;o.textContent=cutoff?cutoff+' Hz':'Filter bypass';$('batch-cutoff').append(o);}renderRows();
    const token=name=>getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim();
    const curves=data.records.map((r,i)=>{const rows=doc.summaries.filter(s=>s.record===r.id);return {x:rows.map(s=>s.cutoff_hz),y:rows.map(s=>s.median_rms_change_mv),name:r.id,type:'scatter',mode:'lines+markers',line:{color:token(['reference','output','secondary'][i]),width:1.5},hovertemplate:'%{x} Hz<br>%{y:.5f} mV<extra>%{fullData.name}</extra>'};});
    await Plotly.react($('batch-chart'),curves,{paper_bgcolor:token('surface'),plot_bgcolor:token('surface'),font:{family:token('font-body'),size:10,color:token('muted')},margin:{l:70,r:20,t:85,b:60},xaxis:{title:{text:'Cutoff (Hz; 0 = filter bypass)'},gridcolor:token('grid')},yaxis:{title:{text:'Median RMS change (mV)'},gridcolor:token('grid'),rangemode:'tozero'},legend:{orientation:'h',x:0,y:1.05,yanchor:'bottom'}},{responsive:true,displayModeBar:false});
  }
  $('batch-run').onclick=async()=>{
    if(!config||busy)return;cancel('Calculating batch…');busy=true;const token=revision,protocol=structuredClone(config);
    $('batch-run').disabled=true;$('batch-cancel').hidden=false;$('batch-progress').hidden=false;$('batch-progress').value=0;$('batch-progress').max=protocol.cutoffs_hz.length*36;
    try{
      const iterator=E.calculate(protocol,data);let step;
      do{
        if(token!==revision)return;
        step=iterator.next();
        if(!step.done){$('batch-progress').value=step.value.completed;if(step.value.completed===1||step.value.completed%12===0)$('batch-status').textContent=`Calculated ${step.value.completed} / ${step.value.total} lead-setting results.`;await new Promise(resolve=>setTimeout(resolve,0));}
      }while(!step.done);
      if(token!==revision)return;documentResult=step.value;await render(documentResult);
      if(token!==revision)return;lock(false);$('batch-status').textContent=`Batch complete: ${documentResult.rows.length} results, 3 recordings, 12 leads and ${protocol.cutoffs_hz.length} cutoffs.`;
    }catch(error){if(token===revision)$('batch-status').textContent='Batch failed: '+error.message;}
    finally{if(token===revision){busy=false;$('batch-run').disabled=!config;$('batch-cancel').hidden=true;$('batch-progress').hidden=true;}}
  };
  $('batch-cancel').onclick=()=>cancel('Batch cancelled. Run again to calculate all results.');
  $('batch-cutoff').onchange=renderRows;
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  $('batch-json').onclick=()=>{if(documentResult&&!$('batch-json').disabled)download('ecg-batch.json',JSON.stringify(documentResult)+'\n','application/json');};
  $('batch-csv').onclick=()=>{
    if(!documentResult||$('batch-csv').disabled)return;
    const d=documentResult,keys=Object.keys(d.rows[0].metrics),lines=['# '+d.source.attribution,'# Source: '+d.source.source_url+'; license: '+d.source.license_url,'# Protocol: '+JSON.stringify(d.config),'# Analysis samples [1000,7000) at 1000 Hz. JSON provides full replay metadata.',['record','lead','cutoff_hz','clip_mv','taps','mode',...keys].join(',')];
    for(const r of d.rows)lines.push([r.record,r.lead,r.cutoff_hz,d.config.clip_mv,d.config.taps,d.config.mode,...keys.map(k=>r.metrics[k])].join(','));
    download('ecg-batch-results.csv',lines.join('\n')+'\n','text/csv');
  };
  new ResizeObserver(()=>{if($('batch-chart').data)Plotly.Plots.resize($('batch-chart'));}).observe($('batch-chart'));
})();
