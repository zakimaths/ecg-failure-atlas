"""Five bounded experiments with fully resolved processing plans."""

import numpy as np
from scipy import signal
from .reference import generate
from .transforms import pipeline
from .metrics import errors, measure, peak

CATALOG = {
    "clipping": {
        "number": "01",
        "title": "Clipping",
        "short": "Clipping",
        "question": "What disappears when the signal hits a hard limit?",
        "summary": "Compare the reference waveform with samples limited to a fixed amplitude.",
        "explanation": "A hard limit flattens values above the threshold. No smoothing or rescaling can recover the missing peak from the clipped samples alone. Timing is shown as a plateau span, not a uniquely detected R peak.",
        "limitation": "An original ECG-like engineering waveform, not a patient recording or a physiological simulator.",
        "control": "Clipping limit",
        "unit": "mV",
        "values": [0.4, 0.65, 0.9],
        "default": 1,
        "view": [0.45, 1.1],
        "y_range": [-0.4, 1.12],
    },
    "delay": {
        "number": "02",
        "title": "Timing delay",
        "short": "Timing delay",
        "question": "How does a known sample shift change event timing?",
        "summary": "A known sample shift preserves the waveform shape and changes event timing. The main comparison is unaligned.",
        "explanation": "Samples shift to the right with zeros at the beginning; nothing wraps around. The optional aligned view removes only the declared delay and excludes the unrecoverable tail. A pure delay is a control experiment, not a model of every filter.",
        "limitation": "The measured landmark is the maximum of a known synthetic beat. This is not detector accuracy.",
        "control": "Delay",
        "unit": "samples",
        "values": [2, 5, 12],
        "default": 1,
        "view": [0.48, 1.1],
        "y_range": [-0.4, 1.12],
    },
    "aliasing": {
        "number": "03",
        "title": "Downsampling and aliasing",
        "short": "Aliasing",
        "question": "Where does an 80 Hz tone go at 100 samples per second?",
        "summary": "Dropping samples turns an 80 Hz input into a 20 Hz alias. An antialias filter suppresses it before resampling.",
        "explanation": "The faint trace is the original 500 Hz sampling of an 80 Hz test tone. At 100 Hz sampling, the naive result equals a negative 20 Hz sine at those sample times. The filtered branch uses an explicit symmetric FIR before downsampling; the ideal rejection reference is zero.",
        "limitation": "A single-frequency engineering probe, not an 80 Hz heart rhythm. Interior measurements exclude 0.5 seconds at each edge.",
        "control": "Antialias FIR length",
        "unit": "taps",
        "values": [31, 61, 101],
        "default": 1,
        "view": [1.0, 1.2],
        "y_range": [-1.15, 1.15],
    },
    "baseline": {
        "number": "04",
        "title": "Baseline-wander filtering",
        "short": "Baseline wander",
        "question": "How does the high-pass filter change the clean reference?",
        "summary": "A high-pass filter reduces slow drift. The same filter also changes parts of the original waveform.",
        "explanation": "A known 0.3 Hz sinusoid is added to the reference. Both the corrupted signal and the clean reference pass through the same second-order Butterworth high-pass filter, forward and backward. The clean-input branch exposes distortion caused by filtering itself.",
        "limitation": "Offline filtering uses future samples. These errors describe this synthetic waveform, not clinical acceptability or an optimal ECG cutoff.",
        "control": "High-pass cutoff",
        "unit": "Hz",
        "values": [0.1, 0.5, 1.0],
        "default": 1,
        "view": [3.0, 5.4],
        "y_range": [-0.8, 1.6],
    },
    "edges": {
        "number": "05",
        "title": "Filtering near a boundary",
        "short": "Filter edges",
        "question": "Does filtering a short crop equal cropping a filtered signal?",
        "summary": "The same offline filter gives different answers near the boundary when context is missing.",
        "explanation": "One branch filters the full 8-second reference, then crops it. The other crops first and filters that short segment using odd padding of 27 samples. Forward–backward filtering has zero phase in its ideal response, but squares the magnitude response and depends on boundary handling.",
        "limitation": "The long-context output is a comparison branch, not physiological truth. The original reference remains visible; this filter can alter it too.",
        "control": "Low-pass cutoff",
        "unit": "Hz",
        "values": [10.0, 20.0, 35.0],
        "default": 1,
        "view": [2.696, 3.1],
        "y_range": [-0.4, 1.12],
    },
}


def resolve(kind, value):
    if kind not in CATALOG or value not in CATALOG[kind]["values"]:
        raise ValueError("Unknown case or unsupported prepared setting")
    ref = {"kind": "ecg_like", "fs_hz": 500.0, "duration_s": 8.0}
    plan = {
        "kind": kind,
        "value": value,
        "reference": ref,
        "input_steps": [],
        "output_steps": [],
        "comparison_steps": [],
        "boundary": "See each step: causal state is zero; delay zero-pads; offline filters use odd padding",
    }
    if kind == "clipping":
        plan["output_steps"] = [{"op": "clip", "limit_mv": value}]
    elif kind == "delay":
        plan["output_steps"] = [{"op": "delay", "samples": value}]
    elif kind == "aliasing":
        ref.update(kind="tone", duration_s=4.0, frequency_hz=80.0, amplitude_mv=1.0)
        plan["output_steps"] = [{"op": "decimate_naive", "factor": 5}]
        plan["comparison_steps"] = [
            {
                "op": "resample_poly",
                "factor": 5,
                "coefficients": signal.firwin(
                    value, 40.0, fs=500.0, window=("kaiser", 8.0)
                ).tolist(),
            }
        ]
    elif kind == "baseline":
        ref["duration_s"] = 12.0
        plan["input_steps"] = [{"op": "wander", "amplitude_mv": 0.45, "frequency_hz": 0.3}]
        plan["output_steps"] = [
            {
                "op": "highpass",
                "cutoff_hz": value,
                "order": 2,
                "mode": "forward_backward",
                "padlen": 27,
            }
        ]
    elif kind == "edges":
        plan["crop_samples"] = [1348, 2100]
        plan["output_steps"] = [
            {
                "op": "lowpass",
                "cutoff_hz": value,
                "order": 3,
                "mode": "forward_backward",
                "padlen": 27,
            }
        ]
    # Save derived SOS coefficients for inspection; SciPy version is locked for recalculation.
    for step in plan["output_steps"]:
        if step["op"] in ("highpass", "lowpass"):
            step["sos_coefficients"] = signal.butter(
                step["order"], step["cutoff_hz"], btype=step["op"], fs=ref["fs_hz"], output="sos"
            ).tolist()
    return plan


def evaluate(plan, saved=None):
    """Saved-input mode uses stored input and source arrays; never regenerates samples."""
    kind = plan["kind"]
    fs = plan["reference"]["fs_hz"]
    if saved is None:
        source, events = generate(plan["reference"])
    else:
        source, events = saved["source"].copy(), []
    start_s = 0.0
    ref = source.copy()
    if kind == "edges":
        lo, hi = plan["crop_samples"]
        ref = source[lo:hi].copy()
        start_s = lo / fs
    inp, input_fs = pipeline(ref, fs, plan["input_steps"])
    if saved is not None:
        inp = saved["input"].copy()
    out, out_fs = pipeline(inp, input_fs, plan["output_steps"])
    arrays = {"source": source, "reference": ref, "input": inp, "output": out}
    descriptors = {
        name: {"fs_hz": fs, "start_s": 0.0 if name == "source" else start_s} for name in arrays
    }
    descriptors["output"]["fs_hz"] = out_fs
    details = {}
    headline = []
    traces = [
        {"array": "reference", "label": "Reference", "color": "reference"},
        {"array": "output", "label": "Processed", "color": "output"},
    ]
    difference = ["output", "reference"]
    if kind in ("clipping", "delay"):
        rp, op = peak(ref, fs, 0.7), peak(out, fs, 0.7)
        details.update(reference_peak=rp, output_peak=op)
        details["error"] = errors(ref, out, fs)
        if kind == "clipping":
            loss = 100 * (rp["amplitude_mv"] - op["amplitude_mv"]) / rp["amplitude_mv"]
            headline = [
                measure(
                    "Peak amplitude lost",
                    loss,
                    "%",
                    "First synthetic beat; relative to its sampled reference maximum.",
                ),
                measure(
                    "Peak plateau",
                    op["span_ms"],
                    "ms",
                    "Span between first and last exactly tied maximum; timing is ambiguous within this span.",
                ),
                measure(
                    "Samples limited",
                    100 * float(np.mean(np.abs(inp) > plan["value"])),
                    "%",
                    "Strictly beyond the symmetric threshold, across the full record.",
                ),
            ]
        else:
            n = plan["value"]
            arrays["aligned"] = out[n:].copy()
            descriptors["aligned"] = {"fs_hz": fs, "start_s": 0.0}
            details["aligned_error"] = errors(ref[:-n], out[n:], fs)
            headline = [
                measure(
                    "Landmark delay",
                    (op["time_s"] - rp["time_s"]) * 1000,
                    "ms",
                    "Difference between sampled maxima of the first reference beat and delayed beat.",
                ),
                measure(
                    "Declared shift",
                    n,
                    "samples",
                    "Zero-padded pure delay at 500 Hz; no circular wraparound.",
                ),
                measure(
                    "Aligned error",
                    details["aligned_error"]["max_abs_error_mv"],
                    "mV",
                    "Maximum absolute difference after removing the known delay and excluding the last shifted samples.",
                ),
            ]
    elif kind == "aliasing":
        alt, alt_fs = pipeline(inp, fs, plan["comparison_steps"])
        arrays["antialias"] = alt
        arrays["reference"] = np.zeros_like(out)
        descriptors["reference"]["fs_hz"] = out_fs
        descriptors["antialias"] = {"fs_hz": alt_fs, "start_s": 0.0}
        a, b = 50, len(out) - 50
        naive_rms = float(np.sqrt(np.mean(out[a:b] ** 2)))
        filtered_rms = float(np.sqrt(np.mean(alt[a:b] ** 2)))
        suppression = 20 * np.log10(naive_rms / filtered_rms) if filtered_rms > 0 else None
        details.update(
            naive_error=errors(arrays["reference"], out, out_fs, a, b),
            antialias_error=errors(arrays["reference"], alt, out_fs, a, b),
            expected_alias_hz=20.0,
            expected_sign=-1,
        )
        headline = [
            measure(
                "Expected alias",
                20.0,
                "Hz",
                "Analytic result: 80 Hz aliases to −20 Hz at a 100 Hz sample rate; verified against a negative sine.",
            ),
            measure(
                "Naive output RMS",
                naive_rms,
                "mV",
                "Interior [0.5, 3.5) seconds, relative to ideal rejection (zero).",
            ),
            measure(
                "FIR suppression",
                float(suppression) if suppression is not None else None,
                "dB",
                "20 log10(naive RMS / antialias RMS), same interior interval. Not a clinical noise measure.",
            ),
        ]
        traces = [
            {"array": "input", "label": "80 Hz input · 500 Hz sampling", "color": "muted"},
            {"array": "output", "label": "Naive · 100 Hz sampling", "color": "output"},
            {"array": "antialias", "label": "Antialias · 100 Hz sampling", "color": "reference"},
        ]
    elif kind == "baseline":
        clean, _ = pipeline(ref, fs, plan["output_steps"])
        arrays["clean_output"] = clean
        descriptors["clean_output"] = {"fs_hz": fs, "start_s": 0.0}
        a, b = 1000, len(out) - 1000
        details.update(
            raw_error=errors(ref, inp, fs, a, b),
            corrected_error=errors(ref, out, fs, a, b),
            clean_error=errors(ref, clean, fs, a, b),
        )
        headline = [
            measure(
                "Drift input error",
                details["raw_error"]["rmse_mv"],
                "mV RMS",
                "Corrupted input versus reference, [2, 10) seconds.",
            ),
            measure(
                "After filtering",
                details["corrected_error"]["rmse_mv"],
                "mV RMS",
                "Filtered corrupted input versus reference, [2, 10) seconds.",
            ),
            measure(
                "Clean signal changed",
                details["clean_error"]["rmse_mv"],
                "mV RMS",
                "Filtered clean input versus reference, [2, 10) seconds; isolates filter-induced distortion.",
            ),
        ]
        traces.insert(1, {"array": "input", "label": "With baseline wander", "color": "muted"})
        traces.append(
            {"array": "clean_output", "label": "Clean input, filtered", "color": "secondary"}
        )
    elif kind == "edges":
        full, _ = pipeline(source, fs, plan["output_steps"])
        lo, hi = plan["crop_samples"]
        context = full[lo:hi].copy()
        arrays["context"] = context
        descriptors["context"] = {"fs_hz": fs, "start_s": start_s}
        edge_count = 100
        d = np.abs(out - context)
        edge_error = float(max(d[:edge_count].max(), d[-edge_count:].max()))
        interior = errors(context, out, fs, edge_count, len(out) - edge_count)
        details.update(
            context_error=errors(context, out, fs),
            interior_error=interior,
            reference_error=errors(ref, out, fs),
            crop_start_s=start_s,
            edge_intervals_local_s=[[0.0, 0.2], [(len(out) - 100) / fs, len(out) / fs]],
        )
        headline = [
            measure(
                "Boundary difference",
                edge_error,
                "mV",
                "Maximum short-versus-long-context difference in the first and last 200 ms of the crop.",
            ),
            measure(
                "Interior difference",
                interior["max_abs_error_mv"],
                "mV",
                "Maximum short-versus-long-context difference, excluding 200 ms at each boundary.",
            ),
            measure(
                "Padding per side",
                27,
                "samples",
                "Odd extension for both forward–backward branches; the missing measured context is not recovered.",
            ),
        ]
        traces = [
            {"array": "reference", "label": "Original reference", "color": "muted"},
            {"array": "context", "label": "Filter, then crop", "color": "reference"},
            {"array": "output", "label": "Crop, then filter", "color": "output"},
        ]
        difference = ["output", "context"]
    return {
        "arrays": arrays,
        "descriptors": descriptors,
        "events": events,
        "metrics": {"schema_version": 1, "headline": headline, "details": details},
        "traces": traces,
        "difference": difference,
    }
