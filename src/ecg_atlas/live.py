"""Bounded custom experiments and an independent replay of browser calculations."""

import json
from pathlib import Path

import numpy as np
from scipy import signal

from .reference import generate

FS = 500
SAMPLES = 4000
WINDOW = (500, 3500)
SCHEMA = "ecg-atlas-live/1"
TOLERANCE = 1e-10
DEFAULT = {
    "noise_mv": 0.08,
    "seed": 42,
    "wander_mv": 0.0,
    "wander_hz": 0.3,
    "clip_mv": 0.0,
    "cutoff_hz": 35.0,
    "taps": 61,
    "mode": "centered",
}


def validate_config(config):
    if not isinstance(config, dict) or set(config) != set(DEFAULT):
        raise ValueError("Experiment settings have missing or unknown fields")
    for key, lo, hi in (
        ("noise_mv", 0, 0.3),
        ("seed", 1, 4294967295),
        ("wander_mv", 0, 0.6),
        ("wander_hz", 0.05, 2),
        ("clip_mv", 0, 2),
        ("cutoff_hz", 0, 100),
        ("taps", 31, 101),
    ):
        v = config[key]
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            raise ValueError(f"{key} must be a finite number")
        if not lo <= v <= hi:
            raise ValueError(f"{key} must be between {lo} and {hi}")
    if config["seed"] != int(config["seed"]) or config["taps"] not in (31, 61, 101):
        raise ValueError("Use an integer seed and 31, 61 or 101 taps")
    if 0 < config["cutoff_hz"] < 5 or 0 < config["clip_mv"] < 0.1:
        raise ValueError("Enabled cutoff must be at least 5 Hz; clipping at least 0.1 mV")
    if config["mode"] not in ("causal", "centered"):
        raise ValueError("Mode must be causal or centered")
    return dict(config)


def noise(seed, count=SAMPLES):
    """xorshift32, mapped to uniform samples with population variance one."""
    state = int(seed)
    values = np.empty(count)
    for i in range(count):
        state ^= (state << 13) & 0xFFFFFFFF
        state ^= state >> 17
        state ^= (state << 5) & 0xFFFFFFFF
        values[i] = (state / 4294967296 * 2 - 1) * np.sqrt(3)
    return values


def coefficients(config):
    if config["cutoff_hz"] == 0:
        return np.array([1.0])
    return signal.firwin(
        int(config["taps"]), config["cutoff_hz"], fs=FS, window="hamming", scale=True
    )


def process(x, config, b):
    clipped = np.clip(x, -config["clip_mv"], config["clip_mv"]) if config["clip_mv"] else x
    # Full convolution retains the tail needed for a centered offline comparison.
    full = signal.convolve(clipped, b, method="direct", mode="full")
    start = (len(b) - 1) // 2 if config["mode"] == "centered" else 0
    return full[start : start + len(x)].copy()


def measurements(arrays, config, b):
    a, z = WINDOW
    reference, inp, out, clean = (arrays[k] for k in ("reference", "input", "output", "clean"))
    distortion = clean[a:z] - reference[a:z]
    corruption = out[a:z] - clean[a:z]
    total = out[a:z] - reference[a:z]
    delay = (len(b) - 1) // 2 if config["mode"] == "causal" else 0

    def landmark(x, center):
        lo, hi = center - 75, center + 76
        vals = x[lo:hi]
        indices = np.flatnonzero(vals == np.max(vals)) + lo
        return float(np.max(vals)), float((indices[0] + indices[-1]) / 2)

    rp, rt = landmark(reference, 1850)
    op, ot = landmark(out, 1850 + delay)
    return {
        "input_rmse_mv": float(np.sqrt(np.mean((inp[a:z] - reference[a:z]) ** 2))),
        "output_rmse_mv": float(np.sqrt(np.mean(total**2))),
        "clean_rmse_mv": float(np.sqrt(np.mean(distortion**2))),
        "corruption_rmse_mv": float(np.sqrt(np.mean(corruption**2))),
        "total_mse_mv2": float(np.mean(total**2)),
        "clean_mse_mv2": float(np.mean(distortion**2)),
        "corruption_mse_mv2": float(np.mean(corruption**2)),
        "cross_term_mv2": float(2 * np.mean(distortion * corruption)),
        "peak_change_percent": float(100 * (op - rp) / rp),
        "landmark_shift_ms": float((ot - rt) / FS * 1000),
        "filter_delay_ms": float(delay / FS * 1000),
    }


def evaluate(config, saved=None):
    config = validate_config(config)
    if saved is None:
        reference, _ = generate({"kind": "ecg_like", "fs_hz": FS, "duration_s": 8})
        t = np.arange(SAMPLES) / FS
        inp = (
            reference
            + config["noise_mv"] * noise(config["seed"])
            + config["wander_mv"] * np.sin(2 * np.pi * config["wander_hz"] * t)
        )
    else:
        reference, inp = saved["reference"], saved["input"]
    b = coefficients(config)
    arrays = {
        "reference": reference,
        "input": inp,
        "output": process(inp, config, b),
        "clean": process(reference, config, b),
    }
    return {
        "schema": SCHEMA,
        "config": config,
        "fs_hz": FS,
        "analysis_samples": list(WINDOW),
        "coefficients": b.tolist(),
        "arrays": {k: v.tolist() for k, v in arrays.items()},
        "metrics": measurements(arrays, config, b),
    }


def response(b, mode, frequencies):
    f, h = signal.freqz(b, worN=frequencies, fs=FS)
    if mode == "centered":
        h *= np.exp(1j * 2 * np.pi * f / FS * ((len(b) - 1) // 2))
    return h


def read_experiment(path):
    path = Path(path)
    if path.stat().st_size > 2_000_000:
        raise ValueError("Experiment file exceeds 2 MB")

    def invalid(value):
        raise ValueError(f"Invalid JSON number: {value}")

    return json.loads(path.read_text(), parse_constant=invalid)


def replay(document, mode="regenerate"):
    if mode not in ("saved-input", "regenerate"):
        raise ValueError("Unknown replay mode")
    fields = {"schema", "config", "fs_hz", "analysis_samples", "coefficients", "arrays", "metrics"}
    if not isinstance(document, dict) or set(document) != fields or document["schema"] != SCHEMA:
        raise ValueError("Unknown or incomplete experiment format")
    config = validate_config(document["config"])
    if document["fs_hz"] != FS or document["analysis_samples"] != list(WINDOW):
        raise ValueError("Unexpected sample rate or analysis window")
    if not isinstance(document["arrays"], dict) or set(document["arrays"]) != {
        "reference",
        "input",
        "output",
        "clean",
    }:
        raise ValueError("Unexpected arrays")
    arrays = {}
    for key, values in document["arrays"].items():
        if (
            not isinstance(values, list)
            or len(values) != SAMPLES
            or any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in values)
        ):
            raise ValueError(f"Invalid samples in {key}")
        try:
            arrays[key] = np.asarray(values, dtype=float)
        except (OverflowError, TypeError, ValueError) as error:
            raise ValueError(f"Invalid numeric range in {key}") from error
        if not np.isfinite(arrays[key]).all() or np.max(np.abs(arrays[key])) > 16:
            raise ValueError("Samples must be finite and within the bounded ±16 mV envelope")
    expected = evaluate(config, arrays if mode == "saved-input" else None)

    def equal(actual, wanted, label):
        if isinstance(wanted, dict):
            if not isinstance(actual, dict) or set(actual) != set(wanted):
                raise ValueError(f"Missing or unexpected {label}")
            for key in wanted:
                equal(actual[key], wanted[key], f"{label}.{key}")
            return
        if isinstance(wanted, list) and (
            not isinstance(actual, list) or len(actual) != len(wanted)
        ):
            raise ValueError(f"Unexpected length: {label}")
        flat = actual if isinstance(actual, list) else [actual]
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in flat):
            raise ValueError(f"Non-numeric {label}")
        try:
            agrees = np.allclose(actual, wanted, atol=TOLERANCE, rtol=TOLERANCE)
        except (OverflowError, TypeError, ValueError) as error:
            raise ValueError(f"Invalid numeric range: {label}") from error
        if not agrees:
            raise ValueError(f"Replay mismatch: {label}")

    for field in ("arrays", "coefficients", "metrics"):
        equal(document[field], expected[field], field)
    return expected
