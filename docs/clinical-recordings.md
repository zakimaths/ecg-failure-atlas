# Hospital ECG processing analysis

This extension measures sensitivity to a bounded processing pipeline on recorded ECGs. It uses the [PTB Diagnostic ECG Database v1.0.0](https://physionet.org/content/ptbdb/1.0.0/), DOI [10.13026/C28C71](https://doi.org/10.13026/C28C71). PhysioNet attributes collection to Michael Oeff at the Department of Cardiology, University Clinic Benjamin Franklin, Berlin, with the compilation provided by PTB.

## Data selection and provenance

The fixed selection is the first listed recording in each of the first three subject directories in PhysioNet's `RECORDS`: `patient001/s0010_re`, `patient002/s0015lre`, `patient003/s0017lre`. Selection does not depend on the measured processing effects. This is a convenience subset of three subjects and cannot support cohort-level claims.

Each segment contains samples `[0, 8000)` from all 12 standard leads: I, II, III, aVR, aVL, aVF, V1–V6. Samples retain the original 1,000 Hz rate. The separately stored Frank XYZ leads are not included. Header clinical summaries, ages, diagnoses and clinical history are not republished in the subset. Public source record identifiers are retained for attribution and verification.

`src/ecg_atlas/data/ptb-source-lock.json` pins the full original header and signal file URLs and SHA-256 digests. `scripts/prepare-ptb.py` verifies both files before decoding. Its intentionally narrow decoder supports these records' multiplexed little-endian signed WFDB format 16. It verifies byte counts, channel order, initial values and every full channel's WFDB checksum before extracting the segment. Missing-value sentinels are rejected. The published JSON retains the digital integers; conversion is `mV = (count − 0) / 2000`, as specified in the headers. No resampling, centering, normalisation or denoising is applied during extraction.

Reconstruct from the source files into a fresh output:

```sh
uv run --locked python scripts/prepare-ptb.py --download --out build/ptb-rebuilt.json
cmp build/ptb-rebuilt.json src/ecg_atlas/data/ptb-subset.json
```

The first acquisition requires internet access; the bundled subset and replay work offline. The raw source cache is excluded from Git. Clinical data do not enter the synthetic reference engine or its known-truth scores.

## Processing and measurements

Pipeline: recorded lead → optional symmetric hard clipping → optional Hamming-window low-pass FIR. Filter coefficients use the recording's native 1,000 Hz rate. Supported cutoffs are bypass (0) or 5–100 Hz; lengths are 31, 61 or 101 taps. Supported clipping is bypass (0) or 0.1–2 mV. These bounds are demonstration parameters, not clinical recommendations.

Causal mode takes the first 8,000 samples of full convolution, with zero initial state. Centered mode takes an 8,000-sample slice offset by `(L−1)/2` samples. Both assume zeros beyond the segment. Centered mode uses future samples and is for offline processing. The source may already have acquisition filtering, noise, artefacts and baseline offsets.

Measurements use indices `[1000, 7000)`, or `[1, 7)` seconds. Let x be recorded input and y processed output:

- **RMS change:** square root of mean `(y[i] − x[i])²`.
- **Delay-adjusted RMS:** square root of mean `(y[i+d] − x[i])²`, where d is the declared causal FIR delay; d = 0 in centered mode. All required samples exist in the eight-second segment; no wraparound or interpolation is used.
- **Largest change:** maximum absolute unaligned difference over the same interval.
- **Peak-to-peak span:** max minus min of each unaligned signal in the interval. This is not a beat-specific amplitude or R-peak measurement.
- **Declared delay:** d milliseconds at 1,000 Hz. This is the FIR's known delay, not an estimated clinical event shift.

All-lead rows run identical settings independently on the selected record's 12 leads. Sweep rows reuse the same recorded lead and clipping setting, changing only cutoff. They do not rank denoising quality. Zoom affects the plot only.

There is no clean target, beat annotation scoring, disease classification or clinical validation. Small changes can mean that a pipeline did little; large changes may include both desired suppression and unwanted waveform alteration. Synthetic experiments remain available when an error relative to known truth is needed.

## Replay contract

`ecg-atlas-clinical/1` stores the selected lead's input/output, settings, full coefficients, analysis window, measurements, source identity, calibration, file checksums, licence, attribution and citations. Browser replay regenerates the result from its bundled PTB samples. Python independently uses SciPy `firwin` and direct convolution, also loading the pinned subset. Both reject missing or additional fields, altered samples, altered source metadata and numerical mismatches at 1e-10 absolute/relative tolerance.

```sh
uv run --locked ecg-atlas replay-clinical analysis.json
```

Recorded input cannot be analytically regenerated. This command verifies against the pinned source subset and recomputes processing. It does not contact the hospital or authenticate arbitrary uploaded files. Only exports from this clinical contract are accepted. The synthetic custom JSON and prepared-case ZIP formats retain their separate replay commands.

CSV includes attribution, licence, source and settings as `#` comment lines, followed by time and recorded/processed/difference samples. Read it with `pandas.read_csv(path, comment='#')` or skip comment lines. Use JSON for complete replay evidence. Shared URLs carry the record identifier, lead and processing settings, not new patient uploads.

## Licence and citations

Contains information from the **PTB Diagnostic ECG Database**, made available under the [Open Data Commons Attribution License v1.0](https://physionet.org/content/ptbdb/view-license/1.0.0/). The derived subset retains that licence, separately from the project's MIT source code. Attribution and licence links accompany the demo and exported data. Hospital provenance does not imply endorsement.

- Bousseljot R, Kreiseler D, Schnabel A. Nutzung der EKG-Signaldatenbank CARDIODAT der PTB über das Internet. Biomedizinische Technik, Band 40, Ergänzungsband 1 (1995), 317.
- Pollard T et al. PhysioNet as a global platform for biomedical research. Nature Health (2026). [doi:10.1038/s44360-026-00096-z](https://doi.org/10.1038/s44360-026-00096-z).
- [WFDB signal file specification](https://physionet.org/physiotools/wag/signal-5.htm).
