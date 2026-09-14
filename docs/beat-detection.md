# Beat-detection sensitivity

The [hospital recording demo](https://zakimaths.github.io/ecg-failure-atlas/clinical.html#beat-section) compares a fixed classical detector before and after clipping and FIR filtering. It measures changes in candidate locations and interval-based rate estimates. No beat annotations are included in the pinned PTB subset, so unmatched candidates are not labelled false positives or missed true beats.

## Detector contract

`slope-energy/1` is an original, deliberately small detector. It is not an implementation of the complete Pan-Tompkins method or a clinically validated R-peak detector. Both branches use identical settings and a threshold derived only from the recorded branch.

1. Start with the 8,000 samples at 1,000 Hz from the clinical analysis. Round detector input to 0.000001 mV with `floor(x × 1,000,000 + 0.5)`. This fixed-point conversion changes only the detector input, by at most 0.0000005 mV; the source and processed waveform exports retain their original values.
2. Smooth with an 11-sample centred moving average. Take the difference between smoothed values five samples ahead and five behind. Set this difference to zero at the first and last five samples. This is a 10-sample amplitude difference, not a derivative divided by elapsed time.
3. Average squared differences over 81 samples. Score units are 0.000000000001 mV². Integer sums, arbitrary-precision squared differences and integer division round the score to the nearest unit. For the fixed-point implementation the divisor is `11² × 81 = 9801`. All moving windows use zero samples outside the segment.
4. Set the shared threshold to a fraction of the maximum recorded score in samples `[1000, 7000)`. The default fraction is 0.3, with an allowed range of 0.1 to 1. A zero maximum produces no candidates. Processing that reduces scores below this threshold can remove candidates; the processed threshold is never automatically lowered.
5. Find score maxima at or above the threshold. For a flat maximum, take its midpoint rounded down, following [SciPy's local-maximum definition](https://docs.scipy.org/doc/scipy-1.15.3/reference/generated/scipy.signal.find_peaks.html). Visit maxima in descending score order, breaking equal-score ties by earlier sample index.
6. For each maximum in `[920, 7080)`, search within ±80 samples for the largest absolute deviation from a 201-sample centred moving baseline. Quantise that deviation to 0.000001 mV. If multiple samples share the largest value, take the midpoint of the first and last, rounded down. Accept the location only in `[1000, 7000)` and at least the selected minimum spacing from previously accepted locations. The default spacing is 250 ms, allowed range 200 to 500 ms. Return accepted locations in time order.

Absolute-deviation refinement handles inverted leads, but can select an S wave or another dominant deflection. Baseline noise, unusual morphology, close beats and amplitude differences can change the result. The single maximum-based threshold can be dominated by an artefact. The minimum spacing also imposes a limit on resolvable intervals. These are properties to inspect, not evidence of clinical validity.

Python uses integer SciPy convolutions and a prefix sum of arbitrary-precision squared differences. JavaScript uses sliding integer sums and `BigInt` for squared differences. The supported sample envelope is ±32 mV. The final score integers remain within JavaScript's safe integer range.

## Matching and rate estimates

An order-preserving dynamic programme matches recorded and processed candidates one-to-one. It first maximises the number of matches, then minimises the sum of absolute delay-adjusted timing shifts. Remaining ties prefer a match, then skipping a recorded candidate, then skipping a processed candidate.

The matching criterion is `abs(processed_sample - recorded_sample - declared_delay) <= tolerance`. Tolerance defaults to 100 ms and can range from 20 to 150 ms. At this fixed sample rate one sample is one millisecond. Declared delay is `(taps - 1) / 2` for the causal FIR, and zero for the centred filter or filter bypass. The detector's own morphology-dependent displacement is not subtracted.

Exports retain raw shifts and adjusted shifts. Both candidate sets use the same `[1, 7)` second window. A processing delay can move a candidate outside this window and leave an unmatched event near a boundary. Paired differences are descriptive; the recorded candidate set is not reference annotation.

Each rate estimate is `60000 / median(consecutive candidate intervals in ms)`. With fewer than two candidates it is unavailable (`null` in JSON). Rate change requires both estimates. Median timing shifts require at least one matched pair. This short-window estimate can change when detections change even though the source recording is identical.

## Reproducible evidence

The detection JSON format is `ecg-atlas-beats/1`. It contains the complete clinical analysis, source calibration and attribution, processing coefficients, original recorded and processed arrays, detector settings, method constants, quantised scores, candidate indices, all matches, unmatched lists and rate estimates.

```sh
uv run --locked ecg-atlas replay-beats ecg-detection.json
```

Replay first verifies the clinical analysis against the bundled PTB samples, then recomputes the detection comparison in Python. Candidate indices and quantised score arrays must match exactly. Other numerical fields use the clinical format's 1e-10 absolute and relative tolerance. Missing, extra or altered evidence is rejected.

CSV is an event table with source attribution, processing settings and detector settings in comment lines. Use JSON for full replay. Use **Copy comparison link** to save both processing and detector settings in a version 2 link. The ordinary **Copy analysis link** saves processing settings only. Detector settings also travel in the detection JSON. See [complete links and the detector sweep](detector-sweep.md).

The browser automatically updates detections after a successful clinical analysis. Detector edits require **Compare detections**. Pending changes disable detection exports. **Candidates** shows waveform markers; **Detector score** shows both score traces and their shared threshold. All calculations work locally after the page has loaded.

## Verification

Run the controlled Python tests, independent engine comparison and browser checks:

```sh
uv run --locked pytest -q
uv run --locked python scripts/check-beats.py
npm run check:beats
uv run --locked ecg-atlas replay-beats output/playwright/chrome-beats.json
uv run --locked ecg-atlas replay-beats output/playwright/webkit-beats.json
```

Controlled checks cover known pulse locations, a 30 ms delay, polarity reversal, silence, insufficient intervals, attenuation under a shared threshold, identity on recorded data, matching cardinality and cost, invalid settings and altered replay evidence. The engine comparison covers all 36 recorded leads under four pipelines and rotates threshold, spacing and tolerance settings. Browser checks exercise the visible controls, plotted identity detections, threshold view, downloaded JSON/CSV, stale-result protection, offline calculation and mobile fit. These checks establish calculation consistency, not annotated-beat accuracy.
