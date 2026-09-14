'use strict';
(() => {
  const defaults={processing:structuredClone(ECGBatch.defaults),detector:{...ECGBeats.defaults}};
  function validate(c,data){
    if(!c||Object.keys(c).sort().join()!=='detector,processing')throw Error('Unexpected sweep settings.');
    ECGBatch.validate(c.processing,data);ECGBeats.validate(c.detector);
  }
  function* calculate(config,data){
    validate(config,data);
    const c=config.processing,rows=[],filters=[];
    let method;
    for(const cutoff_hz of c.cutoffs_hz){
      let coefficients;
      for(const record of data.records)for(const lead of ECGBatch.leads){
        const a=ECGClinical.evaluate({record:record.id,lead,cutoff_hz,clip_mv:c.clip_mv,taps:c.taps,mode:c.mode},data);
        coefficients=a.coefficients;
        const d=ECGBeats.analyze(a.arrays,config.detector,a.metrics.filter_delay_ms);method=d.method;
        rows.push({record:record.id,lead,cutoff_hz,detection:Object.fromEntries(Object.entries(d).filter(([k])=>!['method','analysis_samples','recorded_score_units','output_score_units'].includes(k)))});
        yield {completed:rows.length,total:c.cutoffs_hz.length*data.records.length*12};
      }
      filters.push({cutoff_hz,coefficients});
    }
    return {schema:'ecg-atlas-stress/1',config:structuredClone(config),source:{...Object.fromEntries(Object.entries(data).filter(([k])=>k!=='records')),records:data.records.map(r=>({id:r.id,files:r.files}))},method,fs_hz:1000,analysis_samples:[1000,7000],leads:[...ECGBatch.leads],filters,rows};
  }
  function evaluate(c,data){const it=calculate(c,data);let step;do{step=it.next();}while(!step.done);return step.value;}
  function value(d,key){
    if(key==='unmatched')return d.recorded_only.length+d.output_only.length;
    if(key==='matched')return d.matches.length;
    if(key==='shift')return d.median_adjusted_shift_ms===null?null:Math.abs(d.median_adjusted_shift_ms);
    if(key==='rate')return d.rate_change_bpm===null?null:Math.abs(d.rate_change_bpm);
    throw Error('Unknown map measurement.');
  }
  globalThis.ECGStress={defaults,validate,calculate,evaluate,value};
})();
