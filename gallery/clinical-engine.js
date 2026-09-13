'use strict';
(function(root){
  const defaults={record:'patient001/s0010_re',lead:'ii',clip_mv:0,cutoff_hz:35,taps:61,mode:'centered'};
  function validate(c,data){
    if(!c||Object.keys(c).sort().join()!==Object.keys(defaults).sort().join())throw Error('Unexpected clinical settings.');
    ECGLive.validate({...ECGLive.defaults,...Object.fromEntries(['clip_mv','cutoff_hz','taps','mode'].map(k=>[k,c[k]]))});
    const r=data.records.find(r=>r.id===c.record);
    if(!r||!Object.hasOwn(r.digital,c.lead))throw Error('Unknown source record or lead.');
    return r;
  }
  function measure(x,y,delay){
    let squares=0,aligned=0,max=0,xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for(let i=1000;i<7000;i++){
      const d=y[i]-x[i];squares+=d*d;aligned+=(y[i+delay]-x[i])**2;max=Math.max(max,Math.abs(d));
      xmin=Math.min(xmin,x[i]);xmax=Math.max(xmax,x[i]);ymin=Math.min(ymin,y[i]);ymax=Math.max(ymax,y[i]);
    }
    return {rms_change_mv:Math.sqrt(squares/6000),aligned_rms_change_mv:Math.sqrt(aligned/6000),max_abs_change_mv:max,recorded_p2p_mv:xmax-xmin,processed_p2p_mv:ymax-ymin,filter_delay_ms:delay};
  }
  function evaluate(config,data){
    const r=validate(config,data),x=r.digital[config.lead].map(v=>(v-data.baseline_adu)/data.gain_adu_per_mv);
    const b=ECGLive.coefficients(config,1000),y=ECGLive.process(x,config,b),delay=config.mode==='causal'?(b.length-1)/2:0;
    const source=Object.fromEntries(Object.entries(data).filter(([k])=>k!=='records'));
    Object.assign(source,{record:r.id,files:r.files,lead:config.lead});
    return {schema:'ecg-atlas-clinical/1',config:{...config},source,fs_hz:1000,analysis_samples:[1000,7000],coefficients:b,arrays:{recorded:x,output:y},metrics:measure(x,y,delay)};
  }
  function compare(a,b,label='experiment'){
    if(Array.isArray(b)){if(!Array.isArray(a)||a.length!==b.length)throw Error('Unexpected length: '+label);b.forEach((v,i)=>compare(a[i],v,label));}
    else if(b&&typeof b==='object'){if(!a||Object.keys(a).sort().join()!==Object.keys(b).sort().join())throw Error('Unexpected fields: '+label);Object.keys(b).forEach(k=>compare(a[k],b[k],label+'.'+k));}
    else if(typeof b==='number'){if(typeof a!=='number'||!Number.isFinite(a)||Math.abs(a-b)>1e-10+1e-10*Math.abs(b))throw Error('Replay mismatch: '+label);}
    else if(a!==b)throw Error('Source or format mismatch: '+label);
  }
  function replay(document,data){if(!document||document.schema!=='ecg-atlas-clinical/1')throw Error('Unknown clinical experiment format.');const expected=evaluate(document.config,data);compare(document,expected);return expected;}
  root.ECGClinical={defaults,validate,measure,evaluate,replay};
})(globalThis);
