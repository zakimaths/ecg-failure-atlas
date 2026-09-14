# Detector sweep

The [detector sweep](https://zakimaths.github.io/ecg-failure-atlas/clinical.html#stress-section) applies the current processing and detector settings to all three PTB recordings and 12 leads. The default cutoffs are 0, 12, 20, 35, 50 and 100 Hz, giving 216 comparisons. A selected cutoff outside that set is added, giving 252 comparisons. Zero bypasses the FIR; clipping still applies.

Clipping, FIR length, timing mode, threshold fraction, minimum candidate spacing and matching tolerance stay fixed within a run. Each lead's threshold comes from its own recorded input and stays fixed across all cutoffs. The detector and matching rules are unchanged from [version 0.5](beat-detection.md).

## Comparison map

Choose a recording and a measurement. Each row is one lead and each column is one cutoff. Every cell opens the corresponding waveform comparison in a new tab, preserving processing and detector settings.

| Measurement | Definition |
| --- | --- |
| Unmatched candidates | Recorded-only count plus processed-only count |
| Matched candidates | Number of one-to-one matched pairs |
| Absolute timing shift | Absolute value of the median delay-adjusted pair shift, in ms |
| Absolute rate change | Absolute value of processed minus recorded candidate-rate estimate, in bpm |

Timing is unavailable without a matched pair. Rate change is unavailable unless both branches have at least two candidates. Unavailable values appear as N/A, not zero. The colour scale runs from zero to the maximum available value across all recordings and cutoffs in the completed run. Changing the selected recording does not rescale it. Cell text remains available for keyboard and screen-reader use. Tables scroll within their frame on narrow screens.

The map uses absolute magnitudes for timing and rate differences. Signed values, candidate indices and individual pair shifts remain in JSON; signed summary values also remain in CSV. No average across independent subjects is implied. These 36 leads belong to three subjects. Candidate differences do not establish detection accuracy, filter quality or clinical performance.

## Export and replay

The JSON schema `ecg-atlas-stress/1` stores the full processing/detector protocol, detector method constants, source attribution and checksums, filter coefficients, lead order and every comparison. Each row includes candidate locations, matches, unmatched candidates, threshold, rate estimates and signed median shifts. Source waveform and score arrays are not duplicated for every cutoff; replay reloads the pinned source and recalculates them.

```sh
uv run --locked ecg-atlas run-stress recipes/detector-sweep.json --out build/detector-sweep.json
uv run --locked ecg-atlas replay-stress build/detector-sweep.json
```

Replay verifies every row and source field against an independent Python calculation, using the clinical format's 1e-10 absolute and relative numerical tolerance. Browser and Python share the fixed-point detector contract but use independent implementations of its window calculations. The browser yields after each completed lead so cancellation and progress remain responsive. Cancelled runs cannot be exported. Changing processing or detector settings hides the previous map and disables exports until another complete run.

CSV contains every record/cutoff, candidate counts, signed rate and timing summaries, plus source and protocol comment lines. Empty numeric fields mean unavailable. JSON is the replay document. Keep exported files with the repository revision when comparing code versions; links recalculate using the currently deployed implementation.

## Complete comparison links

Clinical links beginning `#v2/` contain both the clinical configuration and detector configuration. **Copy comparison link** in the beat section produces this format. Sweep cells use the same format. Opening or reloading restores all settings, validates them and recalculates the single comparison. The format rejects extra configuration fields and out-of-range values. It never contains patient uploads or access credentials.

Existing `#v1/` clinical links remain supported and restore default detector settings. **Copy analysis link** remains the processing-only link. A sweep export retains its complete protocol; a cell link represents one comparison, not the full sweep.

## Verification

```sh
uv run --locked pytest -q
uv run --locked python scripts/check-stress.py
npm run check:stress
uv run --locked ecg-atlas replay-stress output/playwright/chrome-stress.json
uv run --locked ecg-atlas replay-stress output/playwright/webkit-stress.json
```

Tests cover all-lead identity, thresholds fixed across cutoffs, agreement with individual comparisons, missing or altered evidence, invalid settings, 324 independent browser/Python rows, full and legacy links, unavailable map values, cancellation, settings changes during a run, record/metric selection, downloaded evidence, complete-setting drilldown, shared-link reload, offline computation and mobile fit.
