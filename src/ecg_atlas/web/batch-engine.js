'use strict';
(() => {
  const leads=['i','ii','iii','avr','avl','avf','v1','v2','v3','v4','v5','v6'];
  const defaults={clip_mv:0,cutoffs_hz:[0,12,20,35,50,100],taps:61,mode:'centered'};
  function validate(c,data){
    if(!c||Object.keys(c).sort().join()!==Object.keys(defaults).sort().join()||!Array.isArray(c.cutoffs_hz)||c.cutoffs_hz.length<1||c.cutoffs_hz.length>7)throw Error('Use one to seven distinct ascending cutoffs.');
    c.cutoffs_hz.forEach((cutoff,i)=>{
      ECGClinical.validate({...ECGClinical.defaults,clip_mv:c.clip_mv,taps:c.taps,mode:c.mode,cutoff_hz:cutoff},data);
      if(i&&cutoff<=c.cutoffs_hz[i-1])throw Error('Cutoffs must be distinct and ascending.');
    });
  }
  function create(config,data){
    validate(config,data);
    const source={...Object.fromEntries(Object.entries(data).filter(([k])=>k!=='records')),records:data.records.map(r=>({id:r.id,files:r.files}))};
    return {schema:'ecg-atlas-batch/1',config:structuredClone(config),source,fs_hz:1000,analysis_samples:[1000,7000],leads:[...leads],filters:[],rows:[],summaries:[]};
  }
  // The iterator yields after every lead so the browser can paint and cancel a run.
  function* calculate(config,data){
    const doc=create(config,data);
    for(const cutoff_hz of config.cutoffs_hz){
      let coefficients;
      for(const record of data.records){
        const values=[];
        for(const lead of leads){
          const c={record:record.id,lead,cutoff_hz,clip_mv:config.clip_mv,taps:config.taps,mode:config.mode};
          const result=ECGClinical.evaluate(c,data);coefficients=result.coefficients;
          doc.rows.push({record:record.id,lead,cutoff_hz,metrics:result.metrics});values.push(result.metrics.rms_change_mv);
          yield {completed:doc.rows.length,total:config.cutoffs_hz.length*data.records.length*12};
        }
        values.sort((a,b)=>a-b);
        doc.summaries.push({record:record.id,cutoff_hz,lead_count:12,mean_rms_change_mv:values.reduce((a,b)=>a+b,0)/12,median_rms_change_mv:(values[5]+values[6])/2,min_rms_change_mv:values[0],max_rms_change_mv:values[11]});
      }
      doc.filters.push({cutoff_hz,coefficients});
    }
    return doc;
  }
  function evaluate(c,data){const it=calculate(c,data);let step;do{step=it.next();}while(!step.done);return step.value;}
  globalThis.ECGBatch={defaults,leads,validate,calculate,evaluate};
})();
