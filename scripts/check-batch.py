"""Independently compare browser batch results with NumPy/SciPy."""
import json
import subprocess
from ecg_atlas import batch

configs = [batch.DEFAULT, {**batch.DEFAULT, 'cutoffs_hz': [0, 12.5, 35], 'clip_mv': .4, 'mode': 'causal', 'taps': 101}]
code = """
require('./src/ecg_atlas/web/live-engine.js');require('./src/ecg_atlas/web/clinical-engine.js');require('./src/ecg_atlas/web/batch-engine.js');
const fs=require('fs'),data=JSON.parse(fs.readFileSync('src/ecg_atlas/data/ptb-subset.json','utf8')),configs=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(configs.map(c=>ECGBatch.evaluate(c,data))));
"""
result = subprocess.run(['node','-e',code],input=json.dumps(configs),capture_output=True,text=True,check=True,timeout=60)
documents = json.loads(result.stdout)
for doc in documents:
    batch.replay(doc)
print(f'PASS: {len(documents)} batch protocols, {sum(len(d["rows"]) for d in documents)} rows, summaries, coefficients and source')
