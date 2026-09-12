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

Use new directories when repeating. Follow [the browser checklist](browser-checks.md) for interactive checks. The repeatable browser suite is now included in the Mac CI workflow. The final local Chrome and WebKit runs passed. A remote GitHub run remains outstanding.

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

The public repository and Pages workflow are being configured. The local checks above are completed; a remote result will be linked here once observed.
