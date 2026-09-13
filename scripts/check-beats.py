"""Independent JavaScript/SciPy comparison on every recorded lead and four pipelines."""
import json
import subprocess
from ecg_atlas import beats, clinical

configs = [
    {**clinical.DEFAULT, 'record': record['id'], 'lead': lead, **processing}
    for record in clinical.dataset()['records']
    for lead in record['digital']
    for processing in [
        {'cutoff_hz': 0}, {'cutoff_hz': 35},
        {'cutoff_hz': 12, 'taps': 101, 'mode': 'causal', 'clip_mv': .4},
        {'cutoff_hz': 100, 'taps': 31, 'mode': 'causal', 'clip_mv': .1},
    ]
]
code = """
require('./src/ecg_atlas/web/live-engine.js');require('./src/ecg_atlas/web/clinical-engine.js');require('./src/ecg_atlas/web/beats-engine.js');
const fs=require('fs'),data=JSON.parse(fs.readFileSync('src/ecg_atlas/data/ptb-subset.json','utf8')),configs=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(configs.map((c,i)=>ECGBeats.evaluate(ECGClinical.evaluate(c,data),{threshold_ratio:[.1,.3,1][i%3],refractory_ms:[200,250,500][i%3],match_ms:[20,100,150][i%3]}))));
"""
result = subprocess.run(['node', '-e', code], input=json.dumps(configs), capture_output=True, text=True, check=True, timeout=60)
documents = json.loads(result.stdout)
for doc in documents:
    try:
        beats.replay(doc)
    except ValueError as error:
        raise ValueError(f'{doc["analysis"]["config"]}: {error}') from error
print(f'PASS: {len(documents)} detection comparisons; all 36 leads, four pipelines, exact candidate indices and score arrays, matching, rates and source replay')
