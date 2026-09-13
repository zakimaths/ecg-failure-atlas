/* Pure numerical routines, also exercised in Node against Python/SciPy. */
'use strict';
(function (root) {
  const FS = 500, N = 4000, WINDOW = [500, 3500], SCHEMA = 'ecg-atlas-live/1', TOL = 1e-10;
  const defaults = Object.freeze({noise_mv: .08, seed: 42, wander_mv: 0, wander_hz: .3, clip_mv: 0, cutoff_hz: 35, taps: 61, mode: 'centered'});
  function validate(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).sort().join() !== Object.keys(defaults).sort().join()) throw Error('Settings have missing or unknown fields.');
    for (const [key, lo, hi] of [['noise_mv',0,.3],['seed',1,4294967295],['wander_mv',0,.6],['wander_hz',.05,2],['clip_mv',0,2],['cutoff_hz',0,100],['taps',31,101]]) {
      if (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] < lo || config[key] > hi) throw Error(`${key} must be between ${lo} and ${hi}.`);
    }
    if (!Number.isInteger(config.seed) || ![31,61,101].includes(config.taps)) throw Error('Use an integer seed and 31, 61 or 101 taps.');
    if (config.cutoff_hz > 0 && config.cutoff_hz < 5 || config.clip_mv > 0 && config.clip_mv < .1) throw Error('Enabled cutoff must be at least 5 Hz; clipping at least 0.1 mV.');
    if (!['causal','centered'].includes(config.mode)) throw Error('Choose causal or centered filtering.');
    return Object.fromEntries(Object.keys(defaults).map(key => [key, config[key]]));
  }
  function noise(seed, n = N) {
    let state = seed >>> 0;
    return Array.from({length:n}, () => {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      return ((state >>> 0) / 4294967296 * 2 - 1) * Math.sqrt(3);
    });
  }
  function reference() {
    const x = new Array(N).fill(0);
    const components = [[-.19,.12,.035],[-.035,-.18,.012],[0,1,.012],[.035,-.25,.014],[.25,.28,.065]];
    for (let beat = 0; beat < 7; beat++) {
      const center = .7 + beat;
      for (const [shift, amplitude, width] of components) for (let i=0;i<N;i++) x[i] += amplitude * Math.exp(-.5 * ((i/FS-center-shift)/width)**2);
    }
    return x;
  }
  function coefficients(config) {
    if (!config.cutoff_hz) return [1];
    const midpoint = (config.taps-1)/2, fc = config.cutoff_hz/FS;
    const b = Array.from({length:config.taps}, (_,i) => {
      const t = i-midpoint;
      return (t === 0 ? 2*fc : Math.sin(2*Math.PI*fc*t)/(Math.PI*t)) * (.54-.46*Math.cos(2*Math.PI*i/(config.taps-1)));
    });
    const sum = b.reduce((a,v)=>a+v,0);
    return b.map(v=>v/sum);
  }
  function process(x, config, b) {
    const inp = config.clip_mv ? x.map(v=>Math.max(-config.clip_mv,Math.min(config.clip_mv,v))) : x;
    const offset = config.mode === 'centered' ? (b.length-1)/2 : 0;
    return inp.map((_,n) => {
      let sum = 0;
      for (let j=0;j<b.length;j++) {const i=n+offset-j; if (i>=0 && i<inp.length) sum+=b[j]*inp[i];}
      return sum;
    });
  }
  function metrics(arrays, config, b) {
    const {reference:r, input, output:o, clean:c} = arrays;
    let raw=0, total=0, distortion=0, corruption=0, cross=0;
    for (let i=WINDOW[0];i<WINDOW[1];i++) {
      const d=c[i]-r[i], e=o[i]-c[i];
      raw+=(input[i]-r[i])**2; total+=(o[i]-r[i])**2; distortion+=d*d; corruption+=e*e; cross+=2*d*e;
    }
    const count=WINDOW[1]-WINDOW[0], delay=config.mode==='causal' ? (b.length-1)/2 : 0;
    function landmark(x,center) {
      let maximum=-Infinity, first=0,last=0;
      for(let i=center-75;i<=center+75;i++) {
        if (x[i]>maximum) {maximum=x[i];first=i;last=i;} else if(x[i]===maximum) last=i;
      }
      return [maximum,(first+last)/2];
    }
    const [rp,rt]=landmark(r,1850), [op,ot]=landmark(o,1850+delay);
    return {input_rmse_mv:Math.sqrt(raw/count),output_rmse_mv:Math.sqrt(total/count),clean_rmse_mv:Math.sqrt(distortion/count),corruption_rmse_mv:Math.sqrt(corruption/count),total_mse_mv2:total/count,clean_mse_mv2:distortion/count,corruption_mse_mv2:corruption/count,cross_term_mv2:cross/count,peak_change_percent:100*(op-rp)/rp,landmark_shift_ms:(ot-rt)/FS*1000,filter_delay_ms:delay/FS*1000};
  }
  function evaluate(settings, saved) {
    const config=validate(settings), r=saved ? [...saved.reference] : reference();
    const random=saved ? null : noise(config.seed);
    const input=saved ? [...saved.input] : r.map((v,i)=>v+config.noise_mv*random[i]+config.wander_mv*Math.sin(2*Math.PI*config.wander_hz*i/FS));
    const b=coefficients(config), arrays={reference:r,input,output:process(input,config,b),clean:process(r,config,b)};
    return {schema:SCHEMA,config,fs_hz:FS,analysis_samples:[...WINDOW],coefficients:b,arrays,metrics:metrics(arrays,config,b)};
  }
  function response(b,mode,frequencies) {
    const delay=mode==='centered' ? (b.length-1)/2 : 0;
    return frequencies.map(f=>{
      let real=0,imag=0;
      for(let j=0;j<b.length;j++) {const angle=2*Math.PI*f/FS*(j-delay);real+=b[j]*Math.cos(angle);imag-=b[j]*Math.sin(angle);}
      return {real,imag,magnitude:Math.hypot(real,imag)};
    });
  }
  function sweep(config) {
    const original=evaluate(config), values=[...new Set([0,5,8,12,20,35,50,80,100,config.cutoff_hz])].sort((a,b)=>a-b);
    return values.map(value=>{
      const result=evaluate({...config,cutoff_hz:value},original.arrays);
      return {cutoff_hz:value,...result.metrics};
    });
  }
  function replay(document, mode='regenerate') {
    const keys=['schema','config','fs_hz','analysis_samples','coefficients','arrays','metrics'];
    if(!document || Object.keys(document).sort().join()!==keys.sort().join() || document.schema!==SCHEMA) throw Error('Unknown or incomplete experiment format.');
    if(document.fs_hz!==FS || JSON.stringify(document.analysis_samples)!==JSON.stringify(WINDOW)) throw Error('Unexpected sample rate or analysis window.');
    if(!['regenerate','saved-input'].includes(mode)) throw Error('Unknown replay mode.');
    if(!document.arrays || Object.keys(document.arrays).sort().join()!=='clean,input,output,reference') throw Error('Unexpected arrays.');
    for(const [key,values] of Object.entries(document.arrays)) if(!Array.isArray(values) || values.length!==N || !values.every(v=>typeof v==='number' && Number.isFinite(v) && Math.abs(v)<=16)) throw Error(`Invalid samples in ${key}.`);
    const expected=evaluate(document.config,mode==='saved-input' ? document.arrays : undefined);
    function equal(actual,wanted,label) {
      if(Array.isArray(wanted)) {if(!Array.isArray(actual)||actual.length!==wanted.length) throw Error(`Unexpected length: ${label}.`);wanted.forEach((v,i)=>equal(actual[i],v,label));}
      else if(wanted && typeof wanted==='object') {if(!actual || Object.keys(actual).sort().join()!==Object.keys(wanted).sort().join()) throw Error(`Unexpected ${label}.`);for(const k in wanted)equal(actual[k],wanted[k],`${label}.${k}`);}
      else if(typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(actual-wanted)>TOL+TOL*Math.abs(wanted)) throw Error(`Replay mismatch: ${label}.`);
    }
    for(const key of ['arrays','coefficients','metrics'])equal(document[key],expected[key],key);
    return expected;
  }
  root.ECGLive={FS,N,WINDOW,SCHEMA,defaults,validate,noise,reference,coefficients,process,metrics,evaluate,response,sweep,replay};
})(typeof globalThis !== 'undefined' ? globalThis : window);
