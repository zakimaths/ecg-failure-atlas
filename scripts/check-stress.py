"""Compare complete browser detector sweeps with independent Python replay."""
import json
import subprocess
from copy import deepcopy
from ecg_atlas import stress

configs = [deepcopy(stress.DEFAULT), {
    'processing': {'clip_mv': .4, 'taps': 101, 'mode': 'causal', 'cutoffs_hz': [0,12.5,35]},
    'detector': {'threshold_ratio': .4, 'refractory_ms': 300, 'match_ms': 50},
}]
code = """
for(const n of ['live-engine','clinical-engine','batch-engine','beats-engine','stress-engine','clinical-links'])require('./src/ecg_atlas/web/'+n+'.js');
const fs=require('fs'),data=JSON.parse(fs.readFileSync('src/ecg_atlas/data/ptb-subset.json','utf8')),configs=JSON.parse(fs.readFileSync(0,'utf8'));
const a={...ECGClinical.defaults},d={threshold_ratio:.4,refractory_ms:300,match_ms:50};
const round=ECGClinicalLinks.decode(ECGClinicalLinks.encode(a,d),data);
if(JSON.stringify(round)!==JSON.stringify({analysis:a,detector:d}))throw Error('Full link round trip');
const old=ECGClinicalLinks.decode('#v1/'+encodeURIComponent(JSON.stringify(a)),data);
if(JSON.stringify(old.detector)!==JSON.stringify(ECGBeats.defaults))throw Error('Legacy link');
for(const bad of ['#v2/%',ECGClinicalLinks.encode(a,{...d,match_ms:999}),'#v2/'+encodeURIComponent(JSON.stringify({analysis:a,detector:d,extra:1}))]){
 let rejected=false;try{ECGClinicalLinks.decode(bad,data);}catch{rejected=true;}if(!rejected)throw Error('Invalid link accepted');
}
if(ECGStress.value({median_adjusted_shift_ms:null},'shift')!==null||ECGStress.value({rate_change_bpm:null},'rate')!==null)throw Error('Missing map values');
process.stdout.write(JSON.stringify(configs.map(c=>ECGStress.evaluate(c,data))));
"""
result = subprocess.run(['node','-e',code],input=json.dumps(configs),capture_output=True,text=True,timeout=90)
if result.returncode:
    raise RuntimeError(result.stderr)
docs=json.loads(result.stdout)
for doc in docs:
    stress.replay(doc)
print(f'PASS: {sum(len(d["rows"]) for d in docs)} detector sweep rows; independent replay, complete/legacy links, invalid links and unavailable map values')
