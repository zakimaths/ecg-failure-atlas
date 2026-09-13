"""Compare the shipped browser engine with NumPy/SciPy across bounded extremes."""

import json
from pathlib import Path
import subprocess

import numpy as np

from ecg_atlas import live

root = Path(__file__).resolve().parents[1]
configs = [
    {**live.DEFAULT},
    {**live.DEFAULT, "noise_mv": 0, "cutoff_hz": 0},
    {**live.DEFAULT, "noise_mv": 0.3, "seed": 1, "cutoff_hz": 5, "taps": 101},
    {**live.DEFAULT, "seed": 4294967295, "mode": "causal", "taps": 31, "cutoff_hz": 100},
    {**live.DEFAULT, "wander_mv": 0.6, "wander_hz": 2, "clip_mv": 0.1},
    {**live.DEFAULT, "wander_mv": 0.45, "clip_mv": 0.4, "mode": "causal"},
    {**live.DEFAULT, "clip_mv": 2, "wander_hz": 0.05, "cutoff_hz": 12.5},
]
# Test both causal and offline placement for every case.
configs += [{**c, "mode": "causal" if c["mode"] == "centered" else "centered"} for c in configs]
frequencies = [0, 0.5, 5, 12, 35, 50, 100, 200, 250]
python_documents = [live.evaluate(c) for c in configs]
runner = subprocess.run(
    ["node", str(root / "scripts/live-oracle.cjs")],
    input=json.dumps({"configs": configs, "frequencies": frequencies, "documents": python_documents}),
    text=True, capture_output=True, check=True, timeout=60,
)
results = json.loads(runner.stdout)
assert results["python_replay_count"] == len(configs)
for config, observed in zip(configs, results["experiments"], strict=True):
    live.replay(observed["document"], "saved-input")
    live.replay(observed["document"], "regenerate")
    h = live.response(live.coefficients(config), config["mode"], frequencies)
    np.testing.assert_allclose([v["real"] for v in observed["response"]], h.real, atol=1e-12)
    np.testing.assert_allclose([v["imag"] for v in observed["response"]], h.imag, atol=1e-12)
    for row in observed["sweep"]:
        expected = live.evaluate({**config, "cutoff_hz": row["cutoff_hz"]})["metrics"]
        for key, value in expected.items():
            np.testing.assert_allclose(row[key], value, atol=1e-10, rtol=1e-10)
print(f"PASS: {len(configs)} browser/Python experiments, both replay modes, frequency response and sweeps")
