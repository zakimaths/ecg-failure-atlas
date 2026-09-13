"""Deterministic slope-energy beat candidates and paired processing comparisons."""

from copy import deepcopy

import numpy as np
from scipy import signal

from . import clinical

SCHEMA = "ecg-atlas-beats/1"
DEFAULT = {"threshold_ratio": 0.3, "refractory_ms": 250, "match_ms": 100}
METHOD = {
    "name": "slope-energy/1",
    "smooth_samples": 11,
    "derivative_half_span": 5,
    "energy_samples": 81,
    "baseline_samples": 201,
    "refine_radius_samples": 80,
    "score_quantum_mv2": 1e-12,
    "input_quantum_mv": 1e-6,
    "localization_quantum_mv": 1e-6,
    "threshold_source": "maximum recorded-input score in [1000,7000), shared by both branches",
    "matching": "maximum-cardinality, minimum-total-absolute-delay-adjusted-shift; ordered pairs",
}


def validate(config):
    if not isinstance(config, dict) or set(config) != set(DEFAULT):
        raise ValueError("Unexpected detector settings")
    for key, low, high in (
        ("threshold_ratio", 0.1, 1),
        ("refractory_ms", 200, 500),
        ("match_ms", 20, 150),
    ):
        value = config[key]
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not low <= value <= high
        ):
            raise ValueError(f"{key} must be between {low} and {high}")
        if key != "threshold_ratio" and value != int(value):
            raise ValueError(f"{key} must be an integer")


def features(values):
    x = np.asarray(values, dtype=float)
    if x.shape != (8000,) or not np.isfinite(x).all() or np.max(np.abs(x)) > 32:
        raise ValueError("Detector requires 8,000 finite samples within ±32 mV")
    # Fixed-point detector input only. Exported clinical waveforms remain unchanged.
    fixed = np.floor(x * 1e6 + 0.5).astype(np.int64)
    smooth_sum = signal.convolve(fixed, np.ones(11, dtype=np.int64), mode="same", method="direct")
    slope = np.zeros(8000, dtype=np.int64)
    slope[5:-5] = smooth_sum[10:] - smooth_sum[:-10]
    # Python arbitrary-precision integers avoid overflow in squared differences.
    prefix = [0]
    for value in slope:
        prefix.append(prefix[-1] + int(value) ** 2)
    divisor = 11 * 11 * 81
    score = [
        (2 * (prefix[min(8000, i + 41)] - prefix[max(0, i - 40)]) + divisor) // (2 * divisor)
        for i in range(8000)
    ]
    baseline_sum = signal.convolve(
        fixed, np.ones(201, dtype=np.int64), mode="same", method="direct"
    )
    deviation = np.abs(fixed * 201 - baseline_sum)
    amplitude = (2 * deviation + 201) // 402
    return np.asarray(score, dtype=np.int64), amplitude


def candidates(score, amplitude, threshold, refractory):
    if threshold <= 0:
        return []
    peaks, _ = signal.find_peaks(score, height=threshold)
    # Explicit tie-breaking avoids relying on a library's equal-height suppression order.
    accepted = []
    for p in sorted(peaks.tolist(), key=lambda i: (-int(score[i]), i)):
        if not 920 <= p < 7080:
            continue
        left, right = max(0, p - 80), min(8000, p + 81)
        indices = np.flatnonzero(amplitude[left:right] == np.max(amplitude[left:right])) + left
        landmark = int((int(indices[0]) + int(indices[-1])) // 2)
        if 1000 <= landmark < 7000 and all(abs(landmark - q) >= refractory for q in accepted):
            accepted.append(landmark)
    return sorted(accepted)


def pair(recorded, output, delay, tolerance):
    # DP objective: most matches, then smallest sum of absolute adjusted shifts.
    n, m = len(recorded), len(output)
    dp = [[(0, 0, []) for _ in range(m + 1)] for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            options = [dp[i + 1][j], dp[i][j + 1]]
            delta = output[j] - recorded[i] - delay
            if abs(delta) <= tolerance:
                count, cost, pairs = dp[i + 1][j + 1]
                options.insert(
                    0, (count + 1, cost + abs(delta), [(recorded[i], output[j])] + pairs)
                )
            dp[i][j] = min(options, key=lambda item: (-item[0], item[1]))
    matches = [
        {
            "recorded_sample": a,
            "output_sample": b,
            "shift_ms": b - a,
            "adjusted_shift_ms": b - a - delay,
        }
        for a, b in dp[0][0][2]
    ]
    return matches


def rate(peaks):
    return float(60000 / np.median(np.diff(peaks))) if len(peaks) >= 2 else None


def analyze(arrays, config, delay):
    validate(config)
    rs, ra = features(arrays["recorded"])
    os, oa = features(arrays["output"])
    threshold = float(np.max(rs[1000:7000])) * config["threshold_ratio"]
    recorded = candidates(rs, ra, threshold, config["refractory_ms"])
    output = candidates(os, oa, threshold, config["refractory_ms"])
    matches = pair(recorded, output, delay, config["match_ms"])
    used_r = {p["recorded_sample"] for p in matches}
    used_o = {p["output_sample"] for p in matches}
    rr, ro = rate(recorded), rate(output)
    return {
        "method": deepcopy(METHOD),
        "analysis_samples": [1000, 7000],
        "threshold_score_units": threshold,
        "recorded_peaks": recorded,
        "output_peaks": output,
        "matches": matches,
        "recorded_only": [p for p in recorded if p not in used_r],
        "output_only": [p for p in output if p not in used_o],
        "recorded_rate_bpm": rr,
        "output_rate_bpm": ro,
        "rate_change_bpm": ro - rr if rr is not None and ro is not None else None,
        "median_shift_ms": float(np.median([p["shift_ms"] for p in matches])) if matches else None,
        "median_adjusted_shift_ms": float(np.median([p["adjusted_shift_ms"] for p in matches]))
        if matches
        else None,
        "recorded_score_units": rs.tolist(),
        "output_score_units": os.tolist(),
    }


def evaluate(analysis_config, detector_config):
    analysis = clinical.evaluate(analysis_config)
    detection = analyze(
        analysis["arrays"], detector_config, int(analysis["metrics"]["filter_delay_ms"])
    )
    return {
        "schema": SCHEMA,
        "analysis": analysis,
        "detector": deepcopy(detector_config),
        "detection": detection,
    }


def replay(document):
    if not isinstance(document, dict) or document.get("schema") != SCHEMA:
        raise ValueError("Unknown beat-comparison format")
    clinical.replay(document.get("analysis"))
    expected = evaluate(document["analysis"]["config"], document.get("detector"))
    clinical.compare(document, expected)
    # Candidate indices and quantized energy are discrete and must agree exactly.
    for key in ("recorded_peaks", "output_peaks", "recorded_score_units", "output_score_units"):
        if document["detection"][key] != expected["detection"][key]:
            raise ValueError(f"Discrete detector mismatch: {key}")
    return expected
