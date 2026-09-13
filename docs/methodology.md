# Methodology

This atlas measures changes caused by controlled processing. It does not evaluate a disease classifier, implement an ECG detector, or establish clinical filter recommendations.

## References and coordinates

The original ECG-like reference sums fixed Gaussian components with P/Q/R/S/T-like shapes. This is an engineering fixture, not a validated physiological simulator. R-like landmarks are sampled local maxima inside ±50 ms of each component center. Components are not automatically assumed to peak at their centers. The aliasing case uses an analytic sine instead.

Samples are float64, stored little-endian in NPY files, in mV. Array metadata declares the sample rate and the origin in seconds. Sample `i` has time `start_s + i/fs_hz`. Analysis windows are start-inclusive and end-exclusive. Event coordinates refer to the uncropped source. All headline measurements use full-resolution samples; displayed lines connect discrete samples without claiming intervening measurements. Axes are fixed for each case family across settings. Zoom and visibility controls do not change metrics.

## Measurements

RMSE is `sqrt(mean((output-reference)^2))`; maximum error is `max(abs(output-reference))`. No implicit normalization or time alignment is used. A peak is measured in a ±100 ms search window around the first known R-like beat. Exactly tied maxima use the midpoint of their first and last sample times and retain the entire span. That midpoint does not establish a unique peak detection. Peak loss uses the nonzero sampled reference amplitude as the denominator. The current fixtures ensure it is nonzero; this is not a general detector API.

| Experiment | Primary comparison | Boundary / window rule |
|---|---|---|
| Clipping | Symmetric hard limit versus original | Fraction counts values strictly beyond threshold across the whole record; amplitude is first beat |
| Delay | Delayed versus original, unaligned | Zero-padding, no wraparound; aligned branch removes the declared shift and excludes unrecoverable tail |
| Aliasing | Naive downsampled tone versus ideal rejection (zero); antialias branch | 500 to 100 Hz, 80 Hz input; [0.5,3.5) s interior. Expected alias is a **negative** 20 Hz sine |
| Baseline | Filtered corrupted signal versus original; separately filter clean input | 0.45 mV, 0.3 Hz drift. Second-order high-pass forward/backward; odd padding 27; [2,10) s |
| Edges | Crop-then-filter versus filter-then-crop | Third-order low-pass forward/backward; odd padding 27. Crop [2.696,4.2) s; edge regions are first/last 200 ms |

The antialias FIR is explicitly saved: odd symmetric coefficients, Kaiser window beta 8, cutoff 40 Hz at input rate 500 Hz, with lengths 31/61/101. Polyphase resampling uses zero extension. The short FIR settings intentionally expose the tradeoff. Suppression is `20 log10(naive RMS / filtered RMS)`, not a universal noise-rejection score.

Butterworth filters store their second-order-section coefficients in the plan and execute those saved coefficients. Forward–backward processing uses future samples, doubles effective filter order, and squares the ideal magnitude response. “Zero phase” does not mean unchanged morphology or absent boundary transients. The long-context branch is a processing comparison, not new ground truth.

The browser's Difference view is output minus reference, except the edges case, where it is short-context minus long-context output. In aliasing, this is the naive signal minus ideal rejection; the filtered branch remains in Overlay. The delay Difference view is always unaligned, even after inspecting alignment in Overlay.

## Evidence and limits

Independent tests cover literal tiny arrays, a delayed impulse, an analytically derived FIR response, the signed alias, and a first-order Butterworth forward–backward magnitude formula. They also verify deterministic regeneration, stored-input recalculation, exported arrays, checksums, invalid inputs, and all prepared variants. See `tests/` for executable definitions.

Array and numeric metric replay tolerances are absolute 1e-12 and relative 1e-12. This is well below the display precision and the sub-millivolt effects shown, and accommodates insignificant floating-point differences. Analytic test bounds are separately stated in the tests (up to 4e-13 for sine calculations). These passed in the recorded local environment; cross-platform equivalence has not yet been established.

A finite synthetic suite cannot establish robustness across physiological variation, patients, devices, or diagnoses. The separate [hospital recording analysis](clinical-recordings.md) reports processing changes on PTB samples without known clean truth. Detector and classifier evaluation remain outside scope. No ECGSYN code, PTB-XL data, or clinical labels are redistributed here.
