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

ECGSYN is acknowledged in the research report and sources. No ECGSYN code, Numerical Recipes code, PTB-XL recording, or other third-party waveform dataset is included. Engineering samples are generated from the original functions in this repository. The gallery uses local font files and inline profile symbols. It makes no external font requests.

## Optional browser tooling

Playwright CLI and its pinned Playwright dependencies are installed as development tools through `package-lock.json` under their Apache-2.0 licences. They are not included in the hosted gallery. The current locked engine is a prerelease; the toolchain version and verification status are documented separately from the scientific Python environment.

## Local fonts

Press Start 2P is redistributed under the SIL Open Font License 1.1 from the Google Fonts repository. JetBrains Mono Regular and Bold are redistributed under the same licence from the bundled font collection. The unmodified font files and their full licences are included in the gallery and gallery source: `PRESS-START-LICENSE.txt` and `JETBRAINS-MONO-LICENSE.txt`. Fonts are not covered by the project's MIT licence.
