# Custom experiments

The [experiment page](https://zakimaths.github.io/ecg-failure-atlas/lab.html) calculates new results in the browser. It is separate from the five prepared reference experiments. All processing stays on the device.

## What can change

The source is the existing analytic ECG-like reference: 4,000 samples, eight seconds at 500 Hz. The controls combine a seeded uniform disturbance, sinusoidal baseline wander, symmetric clipping and a low-pass FIR. The processing order is fixed:

```text
reference → noise + wander → clipping → FIR → output
reference →                 clipping → FIR → processed clean
```

Noise uses xorshift32 with a nonzero 32-bit seed. The integer state is divided by 2^32, mapped to [−1, 1), then multiplied by √3. The scale control is the distribution's expected RMS; a finite record will not have exactly that RMS or exactly zero mean. The seed and all generated input samples are saved.

Clipping and filtering can each be bypassed by entering zero. Filter length is 31, 61 or 101 taps. An enabled cutoff lies between 5 and 100 Hz. The reference, duration and sample rate remain fixed in this version. It does not support patient uploads or arbitrary processing code.

## Filter construction and timing

The browser constructs a symmetric Hamming-windowed sinc, normalized to unit DC gain. Python independently constructs the coefficients with [`scipy.signal.firwin`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.firwin.html). The cutoff is a nominal half-amplitude point in a finite transition band; it is not an ideal brick-wall boundary or an IIR half-power cutoff.

Causal mode keeps the FIR's group delay, (L − 1)/2 samples. For 61 taps at 500 Hz this is 60 ms. Centered mode extracts a shifted interval from full convolution, removing that delay by using future samples. It is a single offline FIR application, not forward–backward filtering and not a real-time operation. Both modes assume zeros outside the record. The outer second at each boundary is excluded from summary errors.

The response plot evaluates the complex frequency response of the FIR. Magnitude is floored at −100 dB for display; phase is unwrapped and masked below −60 dB, where near-zero gain makes phase less useful to interpret. Clipping is nonlinear and is not described by this frequency-response plot. Python checks the browser's response against [`scipy.signal.freqz`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.freqz.html).

## Separate error from processing distortion

All RMS measurements use samples [500, 3500), equivalent to [1, 7) seconds. They are computed from full-resolution data. Zoom and trace visibility do not alter the measurements.

Let d = processed clean − reference, and e = processed corrupted − processed clean. The total output error is d + e. Consequently:

```text
mean(total²) = mean(d²) + mean(e²) + 2 mean(d × e)
```

The page shows all terms. Their RMS values cannot simply be added. With clipping, e includes the nonlinear interaction between the corruption and the amplitude limit; it is not a separately filtered additive noise signal.

Peak change and timing use the known beat near 3.7 seconds. The search covers ±150 ms around its expected location, shifted by the declared FIR delay in causal mode. Tied maxima use the midpoint between the first and last tied samples. No detector, disease label or clinical timing tolerance is involved.

## Cutoff sweeps

The sweep includes bypass and cutoffs of 5, 8, 12, 20, 35, 50, 80 and 100 Hz, plus the current cutoff if different. It reuses the same reference and corrupted input arrays. Only the cutoff changes. The table reports output RMS error, clean-signal change and the corruption effect. Choosing a row reruns that configuration in the main comparison.

A lower error for one row is evidence about this reference, seed, pipeline and metric. It is not an optimal cutoff for patient ECGs. Try changing the seed, clipping threshold or filter timing to inspect how the ordering changes.

## Files and replay

**Download experiment** produces a JSON with schema `ecg-atlas-live/1`: validated settings, sample rate, analysis interval, FIR coefficients, four complete arrays and the measurement dictionary. The schema identifies this bounded algorithm contract. It is not a cryptographic proof of authorship. Existing prepared-case ZIPs retain their separate checksum and source-revision format.

**Download CSV** contains 4,000 rows of sample times and the four arrays for analysis elsewhere. Use the JSON when replay matters. A shared URL carries settings; it recalculates when opened. Save the JSON to retain the exact original samples across future website changes.

Importing JSON regenerates and compares the experiment before accepting it. Unknown fields, invalid settings, wrong array lengths, non-finite values, samples outside the generous ±16 mV bound for this synthetic contract, files over 2 MB and numerical mismatches are rejected. An unsuccessful import keeps the current result. Edited settings disable exporting until the new calculation finishes.

Python offers two independent checks:

```sh
uv run --locked ecg-atlas replay-live experiment.json --mode saved-input
uv run --locked ecg-atlas replay-live experiment.json --mode regenerate
```

Saved-input mode recalculates from the stored reference and corrupted input; it does not call either generator. Regeneration also recreates the analytic reference and the seeded corruption. Both compare arrays, coefficients and measurements using absolute and relative tolerances of 1e-10. A successful comparison establishes numerical agreement within that contract, not authenticity or clinical validity.

To calculate an experiment directly in Python, edit a copy of `recipes/custom.json` and use a new output file:

```sh
uv run --locked ecg-atlas run-live recipes/custom.json --out build/my-experiment.json
uv run --locked ecg-atlas replay-live build/my-experiment.json --mode regenerate
```

## Repeat the development checks

```sh
uv run --locked pytest -q
uv run --locked python scripts/check-live.py
npm run check:lab
```

The independent comparison script checks 14 configurations, both replay modes, filter responses and every sweep row against NumPy/SciPy. It also imports Python-generated experiments into the browser engine. The browser suite checks controls, rendered samples, pending settings, exports, deep-link reload, replay import, tamper rejection, responsive sizing and offline calculation. GitHub Actions runs these checks before deployment.
