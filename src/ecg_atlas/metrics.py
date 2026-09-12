"""Measurements on full-resolution arrays, with explicit comparison windows."""

import numpy as np
from .reference import validate_signal


def errors(reference, output, fs, start=0, stop=None):
    reference, output = validate_signal(reference), validate_signal(output)
    if reference.shape != output.shape:
        raise ValueError("Comparison arrays must have the same shape and sample rate")
    stop = len(reference) if stop is None else stop
    if not 0 <= start < stop <= len(reference):
        raise ValueError("Analysis interval must be non-empty and within the signal")
    d = output[start:stop] - reference[start:stop]
    return {
        "rmse_mv": float(np.sqrt(np.mean(d * d))),
        "max_abs_error_mv": float(np.max(np.abs(d))),
        "window_s": [start / fs, stop / fs],
        "end_exclusive": True,
    }


def peak(x, fs, center_s, radius_s=0.1):
    """Midpoint of tied maximum samples; retain their span to expose ambiguity."""
    x = validate_signal(x)
    lo = max(0, round((center_s - radius_s) * fs))
    hi = min(len(x), round((center_s + radius_s) * fs) + 1)
    if lo >= hi:
        raise ValueError("Peak search window is empty")
    maximum = np.max(x[lo:hi])
    indices = np.flatnonzero(x[lo:hi] == maximum) + lo
    return {
        "amplitude_mv": float(maximum),
        "time_s": float((indices[0] + indices[-1]) / (2 * fs)),
        "span_ms": float((indices[-1] - indices[0]) / fs * 1000),
        "first_index": int(indices[0]),
        "last_index": int(indices[-1]),
        "definition": "midpoint of first and last exactly tied maximum in ±100 ms window",
    }


def measure(label, value, unit, description):
    if value is not None and not np.isfinite(value):
        raise ValueError("Non-finite metric")
    return {
        "label": label,
        "value": value,
        "unit": unit,
        "description": description,
        "status": "defined" if value is not None else "undefined",
    }
