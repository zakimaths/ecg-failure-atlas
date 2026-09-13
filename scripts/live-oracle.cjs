const fs=require('node:fs');
require('../src/ecg_atlas/web/live-engine.js');
const {configs,frequencies,documents}=JSON.parse(fs.readFileSync(0,'utf8'));
const experiments=configs.map(config=>{
  const document=ECGLive.evaluate(config);
  ECGLive.replay(document,'regenerate');ECGLive.replay(document,'saved-input');
  return {document,response:ECGLive.response(document.coefficients,config.mode,frequencies),sweep:ECGLive.sweep(config)};
});
for(const document of documents){ECGLive.replay(document);ECGLive.replay(document,'saved-input');}
const bad=JSON.parse(JSON.stringify(documents[0]));bad.arrays.output[1200]+=.01;
let rejected=false;try{ECGLive.replay(bad);}catch(_){rejected=true;}
if(!rejected)throw Error('Altered output was accepted');
process.stdout.write(JSON.stringify({experiments,python_replay_count:documents.length}));
