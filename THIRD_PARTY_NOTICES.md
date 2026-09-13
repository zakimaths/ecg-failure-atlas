# Third-party notices

Original project code, documentation and analytic fixtures are covered by the root MIT licence. This does not relicense dependencies.

## Bundled chart library

The generated gallery includes **Plotly.js 3.0.1**, obtained from **Plotly.py 6.1.2** via its `get_plotlyjs()` API. The unmodified JavaScript preserves its copyright and licence comments, including embedded dependency notices. The accompanying [PLOTLY-LICENSE.txt](gallery/PLOTLY-LICENSE.txt) carries the MIT permission text and the Plotly.js and Plotly.py copyright notices. The same licence file is included in gallery source so future exports retain it.

- Plotly.js: Copyright 2012–2025, Plotly, Inc.; MIT licence, as declared in the distributed JavaScript header.
- Plotly.py: Copyright (c) 2016–2024 Plotly Technologies Inc.; MIT licence, as included in the installed distribution.
- Source projects: https://github.com/plotly/plotly.js and https://github.com/plotly/plotly.py.

## Installed Python dependencies

NumPy and SciPy are BSD-3-Clause projects; their wheel distributions carry their full notices and notices for bundled numerical libraries. Plotly.py is MIT licensed. They are installed through the lockfile rather than copied into this repository. Transitive dependencies and development tools retain their own licences, included in their installed distributions.

## Prior art and data

ECGSYN is acknowledged in the research report and sources. No ECGSYN code, Numerical Recipes code or PTB-XL recording is included. The PTB Diagnostic ECG subset is attributed separately below. Engineering samples are generated from the original functions in this repository. The gallery uses local font files and inline profile symbols. It makes no external font requests.

## Optional browser tooling

Playwright CLI and its pinned Playwright dependencies are installed as development tools through `package-lock.json` under their Apache-2.0 licences. They are not included in the hosted gallery. The current locked engine is a prerelease; the toolchain version and verification status are documented separately from the scientific Python environment.

## Local fonts

Press Start 2P is redistributed under the SIL Open Font License 1.1 from the Google Fonts repository. JetBrains Mono Regular and Bold are redistributed under the same licence from the bundled font collection. The unmodified font files and their full licences are included in the gallery and gallery source: `PRESS-START-LICENSE.txt` and `JETBRAINS-MONO-LICENSE.txt`. Fonts are not covered by the project's MIT licence.

## PTB hospital ECG subset

`src/ecg_atlas/data/ptb-subset.json`, its exported `clinical-data.js` and derived clinical downloads contain information from the **PTB Diagnostic ECG Database v1.0.0**, made available under the **Open Data Commons Attribution License v1.0**. This data licence is separate from the project's MIT code licence.

- Dataset: https://physionet.org/content/ptbdb/1.0.0/
- Licence text: https://physionet.org/content/ptbdb/view-license/1.0.0/
- DOI: https://doi.org/10.13026/C28C71
- Collection: Michael Oeff, Department of Cardiology, University Clinic Benjamin Franklin, Berlin. Compilation provided by PTB through PhysioNet.
- Bousseljot R, Kreiseler D, Schnabel A. Nutzung der EKG-Signaldatenbank CARDIODAT der PTB über das Internet. Biomedizinische Technik 40, Ergänzungsband 1 (1995), 317.
- Pollard T et al. PhysioNet as a global platform for biomedical research. Nature Health (2026). doi:10.1038/s44360-026-00096-z.

Only the first eight seconds of 12 standard leads from the first listed record in the first three subject directories are included. Original signed digital samples are retained; no resampling or denoising is performed in extraction. Clinical header comments are omitted. Source URLs, original file SHA-256 digests, calibration, selection and attribution are retained in metadata. See `docs/clinical-recordings.md` for the extraction and replay procedure.
