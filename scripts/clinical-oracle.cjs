const fs=require('node:fs');
require('../src/ecg_atlas/web/live-engine.js');require('../src/ecg_atlas/web/clinical-engine.js');
const data=JSON.parse(fs.readFileSync('src/ecg_atlas/data/ptb-subset.json','utf8'));
const request=JSON.parse(fs.readFileSync(0,'utf8'));
for(const doc of request.documents)ECGClinical.replay(doc,data);
const documents=request.configs.map(c=>ECGClinical.evaluate(c,data));
const altered=structuredClone(documents[0]);altered.source.license='MIT';let rejected=false;
try{ECGClinical.replay(altered,data);}catch{rejected=true;}
if(!rejected)throw Error('Changed licence accepted');
process.stdout.write(JSON.stringify({documents,python_replays:request.documents.length}));
