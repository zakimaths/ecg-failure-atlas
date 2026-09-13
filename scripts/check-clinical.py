"""Compare all 36 recorded leads in both FIR modes against independent SciPy calculations."""
import json
import subprocess
from ecg_atlas import clinical

configs = [
    {**clinical.DEFAULT, 'record': record['id'], 'lead': lead, 'mode': mode,
     'cutoff_hz': [0, 5, 35, 100][i % 4], 'taps': [31, 61, 101][i % 3],
     'clip_mv': [0, .1, .65, 2][i % 4]}
    for record in clinical.dataset()['records']
    for i, lead in enumerate(record['digital'])
    for mode in ['causal', 'centered']
]
python_documents = [clinical.evaluate(c) for c in configs]
result = subprocess.run(['node', 'scripts/clinical-oracle.cjs'], input=json.dumps({'configs':configs, 'documents':python_documents}), text=True, capture_output=True, check=True, timeout=60)
observed = json.loads(result.stdout)
assert observed['python_replays'] == len(configs)
for doc in observed['documents']:
    clinical.replay(doc)
print(f'PASS: {len(configs)} clinical browser/SciPy comparisons; all records, leads, timing modes and bidirectional replay')
