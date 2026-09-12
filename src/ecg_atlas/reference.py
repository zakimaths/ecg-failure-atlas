"""Original analytic references. No external ECG generator code or patient data."""

import numpy as np


def validate_signal(x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim != 1 or not len(x) or not np.isfinite(x).all():
        raise ValueError("Signal must be a non-empty finite one-dimensional array")
    return x


def timebase(fs, duration):
    if not np.isfinite([fs, duration]).all() or fs <= 0 or duration <= 0:
        raise ValueError("Sample rate and duration must be finite and positive")
    n = round(fs * duration)
    if n < 1 or n > 2_000_000:
        raise ValueError("Reference must contain 1 to 2,000,000 samples")
    return np.arange(n, dtype=np.float64) / fs


def generate(spec):
    """Return samples and landmarks; component centers are not claimed as extrema."""
    fs = spec["fs_hz"]
    t = timebase(fs, spec["duration_s"])
    kind = spec["kind"]
    events = []
    if kind == "tone":
        hz = spec["frequency_hz"]
        if not np.isfinite(hz) or not 0 < hz < fs / 2:
            raise ValueError("Tone frequency must lie between zero and Nyquist")
        x = spec.get("amplitude_mv", 1.0) * np.sin(2 * np.pi * hz * t)
    elif kind == "ecg_like":
        x = np.zeros_like(t)
        # Deliberately simplified P-Q-R-S-T-like components; not a physiology model.
        for center in np.arange(0.7, spec["duration_s"] - 0.3, 1.0):
            for shift, amp, width in [
                (-0.19, 0.12, 0.035),
                (-0.035, -0.18, 0.012),
                (0, 1, 0.012),
                (0.035, -0.25, 0.014),
                (0.25, 0.28, 0.065),
            ]:
                x += amp * np.exp(-0.5 * ((t - center - shift) / width) ** 2)
            lo, hi = round((center - 0.05) * fs), round((center + 0.05) * fs) + 1
            idx = lo + int(np.argmax(x[lo:hi]))
            events.append(
                {
                    "kind": "sampled_reference_R_like_maximum",
                    "index": idx,
                    "time_s": idx / fs,
                    "search_window_s": [0.05, 0.05],
                }
            )
    else:
        raise ValueError(f"Unknown reference kind: {kind}")
    return validate_signal(x), events
