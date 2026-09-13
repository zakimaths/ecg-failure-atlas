# Fixed-subset batch benchmark

The batch protocol uses the same three PTB recordings and twelve leads as the [clinical analysis](clinical-recordings.md). A row is one **record × lead × cutoff** result. At the default six cutoffs, this yields 216 rows, drawn from three subjects. No additional dataset is introduced.

## Protocol

`recipes/batch.json` specifies clipping in mV, ascending unique low-pass cutoffs in Hz, FIR length and causal/centered timing. One to seven cutoffs are allowed, each either filter bypass (0) or 5–100 Hz. The existing clinical engine validates the remaining bounds. Each lead uses its original 8,000 samples at 1,000 Hz. Measurements use [1, 7) seconds, with the same boundary assumptions and definitions as single-record analysis.

The browser takes clipping, length and timing from the **applied** clinical analysis. It sweeps 0, 12, 20, 35, 50 and 100 Hz, plus the applied cutoff if different. Bypass disables the FIR only: clipping can still change the signal. Full identity requires clipping and filtering both to be bypassed.

## Summaries

For each record and cutoff, summarize the 12 RMS-change measurements with their arithmetic mean, median, minimum and maximum. The median averages the sixth and seventh sorted values. The mean is a mean of lead RMS values, not a pooled RMS across all samples. Plot lines show each record's median and connect tested settings for readability; intermediate settings have not been evaluated unless explicitly included in the protocol.

The leads of one ECG are dependent measurements, not independent subjects. No confidence interval, statistical significance, population estimate, disease label or optimal filter claim is produced. A small change from recorded input is not evidence of better denoising. The three-record selection is a convenience subset, not a representative benchmark cohort.

## Evidence and replay

The `ecg-atlas-batch/1` JSON includes the protocol, source metadata and original-file SHA-256 hashes, all row metrics, per-record summaries, analysis interval, ordered lead list and one coefficient array per cutoff. Shared source waveforms are not duplicated hundreds of times. Replay reloads the committed PTB subset, recomputes every processing branch using SciPy, and compares every source field, coefficient, row and summary within 1e-10 absolute/relative numerical tolerance. The source preparation and subset checksum checks remain part of the project.

```sh
uv run --locked ecg-atlas run-batch recipes/batch.json --out build/my-batch.json
uv run --locked ecg-atlas replay-batch build/my-batch.json
```

Choose a fresh output filename. All numerical calculations work offline after installation. Reconstruct the source subset from the pinned PhysioNet files using the procedure in the clinical methods document if source-level reacquisition is required.

CSV includes all row-level metrics and settings plus comment lines containing data attribution and licence. Use `comment='#'` when reading it with pandas. CSV is for analysis; JSON is the complete batch replay contract. Exports contain all cutoffs regardless of the table's display filter.

## Browser execution

The calculation yields to the browser between individual leads. Progress counts completed lead-setting calculations. Cancellation and changes to clinical settings stop the active iteration and disable exports. Partial results are never exported. Previous complete tables may remain visible, accompanied by a stale-result status. Each row links to its exact record, lead and pipeline settings in the single-record view.

Data retain the PTB Diagnostic ECG Database's [ODC Attribution v1.0 licence](https://physionet.org/content/ptbdb/view-license/1.0.0/). Source provenance and citations are carried in every batch JSON and linked in the clinical demo.
