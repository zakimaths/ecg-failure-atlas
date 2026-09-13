"""Processing sensitivity on a fixed, attributed subset of hospital ECG recordings."""

import json
from pathlib import Path

import numpy as np
from scipy import signal

from . import live

SCHEMA = "ecg-atlas-clinical/1"
FS = 1000
WINDOW = [1000, 7000]
DEFAULT = {
    "record": "patient001/s0010_re",
    "lead": "ii",
    "clip_mv": 0,
    "cutoff_hz": 35,
    "taps": 61,
    "mode": "centered",
}
DATA_PATH = Path(__file__).parent / "data/ptb-subset.json"


def dataset():
    return json.loads(DATA_PATH.read_text())


def validate(config, data):
    if not isinstance(config, dict) or set(config) != set(DEFAULT):
        raise ValueError("Unexpected clinical settings")
    numeric = {k: config[k] for k in ("clip_mv", "cutoff_hz", "taps", "mode")}
    live.validate_config({**live.DEFAULT, **numeric})
    record = next((r for r in data["records"] if r["id"] == config["record"]), None)
    if (
        record is None
        or not isinstance(config["lead"], str)
        or config["lead"] not in record["digital"]
    ):
        raise ValueError("Unknown source record or lead")
    return record


def measure(recorded, output, delay):
    left, right = WINDOW
    x = np.asarray(recorded)[left:right]
    y = np.asarray(output)[left:right]
    aligned = np.asarray(output)[left + delay : right + delay]
    return {
        "rms_change_mv": float(np.sqrt(np.mean((y - x) ** 2))),
        "aligned_rms_change_mv": float(np.sqrt(np.mean((aligned - x) ** 2))),
        "max_abs_change_mv": float(np.max(np.abs(y - x))),
        "recorded_p2p_mv": float(np.ptp(x)),
        "processed_p2p_mv": float(np.ptp(y)),
        "filter_delay_ms": float(delay),
    }


def evaluate(config, data=None):
    data = dataset() if data is None else data
    record = validate(config, data)
    recorded = (
        np.asarray(record["digital"][config["lead"]], dtype=float) - data["baseline_adu"]
    ) / data["gain_adu_per_mv"]
    b = (
        signal.firwin(int(config["taps"]), config["cutoff_hz"], fs=FS, window="hamming", scale=True)
        if config["cutoff_hz"]
        else np.array([1.0])
    )
    output = live.process(recorded, config, b)
    delay = (len(b) - 1) // 2 if config["mode"] == "causal" else 0
    source = {k: v for k, v in data.items() if k != "records"}
    source.update({"record": record["id"], "files": record["files"], "lead": config["lead"]})
    return {
        "schema": SCHEMA,
        "config": dict(config),
        "source": source,
        "fs_hz": FS,
        "analysis_samples": WINDOW.copy(),
        "coefficients": b.tolist(),
        "arrays": {"recorded": recorded.tolist(), "output": output.tolist()},
        "metrics": measure(recorded, output, delay),
    }


def compare(actual, expected, label="experiment"):
    if isinstance(expected, dict):
        if not isinstance(actual, dict) or set(actual) != set(expected):
            raise ValueError(f"Unexpected fields: {label}")
        for key in expected:
            compare(actual[key], expected[key], f"{label}.{key}")
    elif isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            raise ValueError(f"Unexpected length: {label}")
        for a, b in zip(actual, expected, strict=True):
            compare(a, b, label)
    elif isinstance(expected, (int, float)):
        if (
            isinstance(actual, bool)
            or not isinstance(actual, (int, float))
            or not np.isfinite(actual)
            or abs(actual - expected) > 1e-10 + 1e-10 * abs(expected)
        ):
            raise ValueError(f"Replay mismatch: {label}")
    elif actual != expected:
        raise ValueError(f"Source or format mismatch: {label}")


def replay(document):
    if not isinstance(document, dict) or document.get("schema") != SCHEMA:
        raise ValueError("Unknown clinical experiment format")
    expected = evaluate(document.get("config"))
    compare(document, expected)
    return expected
