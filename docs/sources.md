# Technical sources

The larger research report in the repository covers scope, licensing, prior art and alternatives. These primary sources support the implemented mechanisms (checked 12 September 2026):

- [SciPy resample_poly](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.resample_poly.html): explicit FIR coefficients, zero extension, and rational resampling.
- [SciPy sosfiltfilt](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfiltfilt.html): forward/backward filtering and boundary options.
- [SciPy filtfilt](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.filtfilt.html): combined zero phase and twice the original filter order.
- [SciPy butter](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.butter.html): Butterworth design and SOS representation.
- [NumPy NPY format](https://numpy.org/doc/stable/reference/generated/numpy.lib.format.html): array format and stored type/shape.
- [uv locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/): locked environment behavior.
- [Plotly.js function reference](https://plotly.com/javascript/plotlyjs-function-reference/): local chart creation and updates.
- [GitHub hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners): `macos-15` is an arm64 runner; the workflow also asserts the actual architecture.
- [actions/checkout v4.2.2 commit](https://github.com/actions/checkout/commit/11bd71901bbe5b1630ceea73d27597364c9af683): pinned action revision used by the verification workflow.
- [ECGSYN](https://physionet.org/content/ecgsyn/1.0.0/): prior physiological waveform generator. No code from this resource is included.

The sinusoid, Gaussian components and test oracles in this repository are original implementations. Prior art is acknowledged; no novelty claim is made for generation, filtering, or aliasing. The contribution is the inspectable experiment and replay workflow.
