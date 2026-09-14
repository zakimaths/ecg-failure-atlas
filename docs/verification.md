# Verification record

Observed locally on **12 September 2026**. This is a development verification record, not clinical validation or a published CI result.

## Environment

- Native Apple Silicon: `arm64`.
- macOS: `26.6.2` (as reported by Python's platform API).
- CPython: `3.12.12`; uv: `0.9.17`.
- NumPy: `2.2.6`; SciPy: `1.15.3`; Plotly.py: `6.1.2` / bundled Plotly.js: `3.0.1`.
- Browser automation: Chrome `152.0.7977.84`; Playwright WebKit `26.5` (build `2358`). WebKit testing is not a claim of testing the Safari app itself.

## Observed passes

| Check | Observed result |
|---|---|
| `uv sync --locked` | Installed/audited the locked environment successfully |
| `uv run --locked pytest -q` | **45 passed**; last full run 1.50 seconds, no warnings |
| Ruff source checks and formatting | Passed for `src/` and `tests/` |
| JavaScript syntax check | Passed |
| Demo build | **15** self-contained cases created |
| Collection verification | All 15 passed hashes, IDs and array checks |
| Saved-input replay | All 15 passed without regenerating source samples |
| Full regeneration | All 15 passed array, metric and event comparisons |
| Actual browser download | Selected clipping ZIP downloaded; extracted payload passed both replay modes |
| Source provenance | Gallery's recorded Python source fingerprint matched the implementation |
| Fresh static export | All **42 gallery files** matched the checked gallery byte-for-byte on this machine |
| Chrome controls | All 15 settings; all five overlays and difference views; alignment; keyboard radio selection; deep-link reload |
| Copy link | Successful clipboard feedback observed manually; automated denial check confirmed the fallback address |
| Chrome narrow viewport | 390 × 844; no document-level horizontal overflow; full-page screenshot inspected |
| WebKit controls | All 15 settings and five difference views rendered |
| WebKit narrow viewport | 390 px wide; chart resize check confirmed SVG width equals its container; desktop-to-mobile transition checked |
| Offline gallery | Chrome opened the file gallery with network disabled; WebKit changed a loaded page with network disabled. Direct file navigation was not verified in WebKit |
| Runtime errors | No JavaScript page errors during the final Chrome offline/load check |

The first visual WebKit check caught a stale plot width immediately after resizing. The app now observes chart-container size changes and resizes after rendering. A subsequent dimension check and screenshot confirmed the complete chart fits the narrow viewport. An initial missing-favicon request was also corrected with a local icon.

Screenshots: [desktop](assets/gallery-desktop.png), [Chrome mobile](assets/gallery-mobile.png). The screenshots are captured working interfaces with calculated data.

## Repeat the checks

From a fresh checkout or extracted source archive:

```sh
uv sync --locked
uv run --locked pytest -q
uv run --locked ruff check src tests
uv run --locked ruff format --check src tests
uv run --locked ecg-atlas build recipes/demo.json --out build/check
uv run --locked ecg-atlas verify build/check
uv run --locked ecg-atlas replay build/check --mode saved-input
uv run --locked ecg-atlas replay build/check --mode regenerate
uv run --locked ecg-atlas export-gallery build/check --out build/check-gallery
```

Use new directories when repeating. Follow [the browser checklist](browser-checks.md) for interactive checks. The repeatable browser suite is included in the Mac CI workflow. Local Chrome and WebKit runs passed; the remote WebKit result is recorded below.

## Release-preparation follow-up

A separate source copy under `build/clean-room/` was installed into its own virtual environment using `uv sync --locked`. The imported package and interpreter paths were confirmed to come from that copy. **All 45 tests passed**, and all 15 experiments regenerated successfully. **102 array, metric and event files were byte-identical** to the first build. This is a clean environment on the same Mac using the existing dependency cache; it is not an independent second-machine or cold-download test.

The new `scripts/verify-gallery.py` also passed on all 15 shipped variants. It compares browser samples, difference arrays, metadata, metrics and manifests with the downloaded ZIP payload, then runs both replay modes. It is included in the CI build check.

The optional browser runner and scripted demo recorder are implemented under `scripts/`, with Node 26.7.0 recorded in `.node-version` and Playwright CLI 0.1.19 locked in `package-lock.json`. The final automated suite passed in both Chrome and WebKit after the demo redesign. Each engine checked all 15 variants, five difference views, exact trace samples and coordinates, metrics, alignment, keyboard selection, deep-link reload, a download, clipboard denial, responsive sizing, profile links, absence of em dashes and absence of external requests. The [saved browser results](browser-results.json) record the precise offline scope for each engine.

The final layout was inspected at desktop, tablet and mobile widths. A subsequent mobile review led to a contained horizontal experiment selector and full-width measurement rows. The final 390 px screenshot has no document overflow; the chart starts at approximately 706 px. Local fonts and inline profile icons require no third-party requests.

The [demo recording](assets/ecg-failure-atlas-demo.mp4) contains actual clipping and delay interactions and a case download. The H.264 export is 1440 × 1000, 33.48 seconds, with representative clipping, alignment and download frames inspected. The downloaded bundle passed both saved-input and regeneration replay. The opening description predates a small wording reduction; experiment content and calculations are unchanged.

## Not yet established

- A tagged release. Publication and remote verification status are recorded separately below.
- Independent reproduction by another person on a second Mac.
- Testing the Safari application itself, Intel Macs, or a physical mobile device.
- Clinical usefulness, real patient-data performance, detector accuracy, or classifier robustness.
- Bitwise-identical results across different machines or numerical libraries. The replay contract uses declared numerical tolerances and stored payload hashes.

Before publishing measured claims, regenerate release bundles from the chosen source commit and link the public demo to that evidence. Do not substitute this local test record for the outstanding checks.

## GitHub publication

The [first public workflow](https://github.com/zakimaths/ecg-failure-atlas/actions/runs/34688399062) passed on source revision `fe9026173ab70c665870668e81d92790766c85eb`. Its Apple Silicon job passed numerical tests, all 15 bundle builds and both replay modes, the gallery evidence check, and WebKit verification. GitHub Pages deployment also passed.

A clipping bundle downloaded from the [live demo](https://zakimaths.github.io/ecg-failure-atlas/) recorded that same clean source revision and an arm64 macOS 15.7.9 environment. On the local Mac it passed payload verification, saved-input replay and full regeneration. This supplies a second-machine check in a hosted runner, but is not an independent scientific review by another person.

## Version 0.2 custom experiments

Observed locally on **13 September 2026**, on the same Apple Silicon Mac. The locked 0.2.0 environment installed successfully.

- **71 Python tests passed**, including 26 new checks for seeded noise, identity, impulse delay, offline centering, analytic FIR gain/phase, the error cross term, invalid settings and replay rejection.
- **14 browser-engine/Python configurations passed** both replay modes, coefficient and complex frequency-response comparisons, and every cutoff-sweep row. The browser engine also accepted independently produced Python experiments.
- **Chrome and WebKit custom-page checks passed** the four starting questions, custom settings, exact plotted samples, pending export disabling, error decomposition, phase view, sweep selection, JSON/CSV download, reload, clipboard fallback, valid import and rejection of changed output.
- Both custom pages calculated offline. Chrome additionally loaded `lab.html` directly from disk with networking disabled; WebKit used an already loaded page.
- JSON files actually downloaded in Chrome and WebKit passed both Python replay modes. The checked Chrome CSV matched all 4,000 rows of its experiment JSON.
- Desktop and mobile plots were visually inspected. A frame-width mismatch and a mobile legend overlap found during review were corrected. The browser size checks confirm all three charts fit their containers with no document-level overflow.

The custom format's numerical comparison tolerance is 1e-10 absolute and relative. It is separate from the prepared ZIP format and its 1e-12 numerical tolerance. These checks do not validate patient data, detector performance or clinical filter choices. See [the custom experiment method](custom-experiments.md) for the fixed reference, zero-extension boundary rule, noise distribution and error definitions.

## Version 0.3 hospital recording analysis

Observed locally on **13 September 2026**, on Apple Silicon macOS with the locked 0.3.0 environment.

- **90 Python tests passed.** Added checks cover pinned dataset integrity, identity on all 36 recorded lead segments, signed format-16 decoding, source checksum failures, native-rate FIR delay, delay compensation, invalid settings and altered export rejection.
- The three original headers and 12-lead signal files passed SHA-256 and WFDB channel checksum verification. Re-extracting the subset produced a byte-identical JSON file.
- **72 clinical browser-engine/SciPy comparisons passed**, covering every record and lead in both timing modes with bypass, clipping and cutoff/length variations. Browser and Python each replayed the other's results.
- **Chrome and WebKit clinical checks passed:** all three records, plotted source/output samples, identity, 12-lead table, cutoff selection, difference samples, pending export state, JSON/CSV downloads, shared-link reload, clipboard denial, replay import, altered attribution rejection, mobile fit and offline calculation on an already loaded page.
- Each downloaded clinical JSON passed independent Python replay. Every CSV row matched its downloaded JSON, and CSV attribution/licence comments were checked.
- The existing synthetic suites also passed: 14 independent numerical comparisons, all 15 reference cases in Chrome/WebKit, and both custom-page browser suites.

The clinical subset is a convenience selection of three subjects, not a population benchmark. These checks establish source preservation and reproducible computation, not clinical effectiveness. Real-recording measurements are changes from recorded input; no clean physiological ground truth is claimed. See [clinical methods](clinical-recordings.md) and the [clinical browser results](clinical-browser-results.json).

## Process playback follow-up

Observed locally on 13 September 2026. Chrome and WebKit passed the new `npm run check:motion` suite on both hospital and synthetic analysis pages: no autoplay, sequential playback, stop, complete sample paths, stable numerical plot data, cancellation after settings changes, reduced-motion preference changes, keyboard static view and mobile layout. Both existing clinical and custom-analysis browser suites also passed, including exports and replay. The preview operates only on display elements; the numerical engines and replay formats are unchanged. The same motion checks run in the Apple Silicon verification workflow.

## Version 0.4 batch benchmark

Observed locally on 13 September 2026, Apple Silicon macOS, with locked version 0.4.0 dependencies.

- **103 Python tests passed**, adding batch identity coverage, known-value summaries, single-record equivalence, invalid protocol rejection and altered-result/source detection.
- **324 browser-engine batch rows** from two protocols passed independent Python/SciPy replay, including all summaries, coefficients and source fields. The protocols cover the default six-cutoff sweep and a causal, clipped, 101-tap sweep including 12.5 Hz.
- Chrome and WebKit passed batch cancellation, 216-row default coverage, 18 summaries, 36-row cutoff views, filter-bypass identity, drilldown settings, complete JSON/CSV exports, stale-result protection, mobile fit and offline calculation.
- Actual JSON downloads from both browsers passed Python replay; every CSV metric matched its JSON row.
- Both existing clinical browser suites passed after the integration. The batch navigation checks cover direct and in-page links to the benchmark.

The batch summaries describe three subjects. No lead-independence, clinical efficacy or population-level inference is established by these checks. See [batch methods](batch-benchmark.md).

## Version 0.5 beat-detection comparison

Observed locally on 13 September 2026, Apple Silicon macOS, with locked version 0.5.0 dependencies.

- **118 Python tests passed**, including controlled pulse locations, a known 30 ms delay, polarity reversal, silence, insufficient intervals, attenuation with a shared threshold, recorded identity, optimal one-to-one matching, invalid settings and altered replay evidence.
- **144 independent browser-engine/Python detection comparisons passed**, covering every one of the 36 recorded leads under four processing configurations. Threshold, minimum spacing and matching tolerance vary across runs. Candidate indices and complete fixed-point score arrays agree exactly; matching, rate estimates and source analyses pass replay.
- An initial floating-point implementation produced a one-unit score discrepancy. The released detector uses a documented fixed-point input and integer arithmetic in both implementations, with independent moving-window calculations. Original clinical waveform exports are unchanged.
- Chrome and WebKit passed direct detection-section navigation, unchanged-signal candidate identity, shared-threshold display, detector controls, processing changes, stale export protection, offline calculation, JSON/CSV export and mobile fit. Desktop and mobile plots were visually inspected.
- Actual detection JSON downloads from both browsers passed independent Python replay. CSV event rows matched the JSON pairs and unmatched candidate lists; source attribution was retained.
- Existing clinical, batch and process-playback browser suites passed in both engines. The independent 14 custom experiments, 72 clinical comparisons, 324 batch rows and all 15 prepared gallery variants also passed.

The detector is a reproducible processing-sensitivity experiment. It is not clinically validated. These records supply no beat annotations in the bundled subset, so the project does not report detector sensitivity, precision or disease accuracy. See [the detector method](beat-detection.md).

The first hosted 0.5 check stopped on document overflow during a mobile batch-page resize. Chart frames now contain intermediate render sizes, and browser checks wait for every displayed clinical plot to fit its frame. The strengthened batch and detection checks pass in Chrome and WebKit locally.

## Version 0.6 detector sweep and interface copy

Observed locally on 14 September 2026, Apple Silicon macOS, with locked version 0.6.0 dependencies.

- **130 Python tests passed.** New tests cover all-lead identity, fixed recorded thresholds across cutoffs, agreement with an individual detection comparison, invalid protocols and altered rows, source, filters, candidate indices, rates and detector method constants.
- **324 browser-engine detector sweep rows** across two protocols passed independent Python replay. The second protocol uses clipping, causal filtering, 101 taps, a 12.5 Hz cutoff and non-default detector settings. Complete-link round trips, legacy links, malformed links and unavailable map values also passed.
- Chrome and WebKit passed the new sweep checks: 216-row coverage, record and measurement selection, identity, cancellation, pending settings, offline calculation, complete-setting drilldown, shared-link reload, exports, mobile fit and settings changes during calculation.
- Both downloaded sweep JSON files and the selected single-comparison file passed Python replay. CSV rows matched the complete JSON results. The supplied command-line recipe also produced and replayed all 216 comparisons.
- Existing clinical, single-detector, batch, synthetic custom, playback and 15-case gallery browser suites passed in Chrome and WebKit after integration. An initial concurrent browser-tool run timed out; running browser sessions sequentially completed the checks.
- Desktop and mobile views were inspected. Main-page instructions were shortened, repeated section labels removed, and detailed calculations moved into method disclosures. Source attribution and result limitations remain available. Map instructions sit outside the horizontal table so they wrap on narrow screens.

The sweep measures detector changes across processing settings. It does not add expert beat annotations or establish clinical accuracy. See [the sweep method](detector-sweep.md).
