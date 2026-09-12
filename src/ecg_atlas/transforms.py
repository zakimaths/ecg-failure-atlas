"""An allowlist of explicit, deterministic transforms."""

import numpy as np
from scipy import signal
from .reference import validate_signal


def apply(x, fs, step):
    x = validate_signal(x)
    if not np.isfinite(fs) or fs <= 0:
        raise ValueError("Sample rate must be finite and positive")
    op = step["op"]
    if op == "identity":
        y = x.copy()
    elif op in ("gain", "offset"):
        value = step["value"]
        if not np.isfinite(value):
            raise ValueError("Transform value must be finite")
        y = x * value if op == "gain" else x + value
    elif op == "clip":
        limit = step["limit_mv"]
        if not np.isfinite(limit) or limit <= 0:
            raise ValueError("Clipping limit must be finite and positive")
        y = np.clip(x, -limit, limit)
    elif op == "delay":
        n = step["samples"]
        if not isinstance(n, int) or isinstance(n, bool) or not 0 <= n < len(x):
            raise ValueError("Delay must be an integer within the signal length")
        y = np.zeros_like(x)
        if n == 0:
            y[:] = x
        else:
            y[n:] = x[:-n]
    elif op == "wander":
        amp, hz = step["amplitude_mv"], step["frequency_hz"]
        if not np.isfinite([amp, hz]).all() or amp < 0 or not 0 < hz < fs / 2:
            raise ValueError("Invalid wander amplitude or frequency")
        y = x + amp * np.sin(2 * np.pi * hz * np.arange(len(x)) / fs)
    elif op == "fir":
        b = validate_signal(step["coefficients"])
        y = signal.lfilter(b, [1.0], x)  # zero initial state, causal
    elif op in ("highpass", "lowpass"):
        cutoff = step["cutoff_hz"]
        order = step["order"]
        if not np.isfinite(cutoff) or not 0 < cutoff < fs / 2:
            raise ValueError("Cutoff must lie between zero and Nyquist")
        if not isinstance(order, int) or not 1 <= order <= 12:
            raise ValueError("Filter order must be an integer from 1 to 12")
        sos = np.asarray(
            step.get(
                "sos_coefficients", signal.butter(order, cutoff, btype=op, fs=fs, output="sos")
            ),
            dtype=np.float64,
        )
        if sos.ndim != 2 or sos.shape[1] != 6 or not np.isfinite(sos).all():
            raise ValueError("Invalid saved SOS coefficients")
        if not np.all(sos[:, 3] == 1):
            raise ValueError("SOS denominator leading coefficients must equal one")
        if step["mode"] == "causal":
            y = signal.sosfilt(sos, x)
        elif step["mode"] == "forward_backward":
            pad = step["padlen"]
            if not isinstance(pad, int) or not 0 <= pad < len(x) - 1:
                raise ValueError("Padding must be an integer shorter than the signal")
            y = signal.sosfiltfilt(sos, x, padtype="odd", padlen=pad)
        else:
            raise ValueError("Unknown filter mode")
    elif op in ("decimate_naive", "resample_poly"):
        factor = step["factor"]
        if not isinstance(factor, int) or isinstance(factor, bool) or factor < 1:
            raise ValueError("Resampling factor must be a positive integer")
        if op == "decimate_naive":
            y = x[::factor].copy()
        else:
            b = validate_signal(step["coefficients"])
            if len(b) % 2 != 1 or not np.allclose(b, b[::-1], atol=1e-15, rtol=0):
                raise ValueError("Antialias FIR must be symmetric and odd length")
            y = signal.resample_poly(x, up=1, down=factor, window=b, padtype="constant")
        fs /= factor
    else:
        raise ValueError(f"Unknown transform: {op}")
    return validate_signal(y), float(fs)


def pipeline(x, fs, steps):
    for step in steps:
        x, fs = apply(x, fs, step)
    return x, fs
