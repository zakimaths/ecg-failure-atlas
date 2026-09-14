'use strict';
(() => {
  function encode(analysis,detector){return '#v2/'+encodeURIComponent(JSON.stringify({analysis,detector}));}
  function decode(hash,data){
    if(hash.length>4096)throw Error('Analysis link is too long.');
    let value;
    if(hash.startsWith('#v1/'))value={analysis:JSON.parse(decodeURIComponent(hash.slice(4))),detector:{...ECGBeats.defaults}};
    else if(hash.startsWith('#v2/')){value=JSON.parse(decodeURIComponent(hash.slice(4)));if(!value||Object.keys(value).sort().join()!=='analysis,detector')throw Error('Invalid comparison link.');}
    else throw Error('Invalid analysis link.');
    ECGClinical.validate(value.analysis,data);ECGBeats.validate(value.detector);return value;
  }
  globalThis.ECGClinicalLinks={encode,decode};
})();
