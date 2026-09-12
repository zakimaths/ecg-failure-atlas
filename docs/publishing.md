# Publish the demo

Repository: [zakimaths/ecg-failure-atlas](https://github.com/zakimaths/ecg-failure-atlas).

Demo: [ECG Failure Atlas](https://zakimaths.github.io/ecg-failure-atlas/).

## Deployment

Pushes to `main` run the numerical tests, rebuild and replay all 15 cases, and check the generated gallery in WebKit on an Apple Silicon runner. The workflow deploys that checked output to GitHub Pages only after verification passes. Pull requests run verification without deployment.

The hosted gallery is generated from the deployed source revision. For a release, regenerate the checked-in `gallery/` from a clean source commit, check the downloads and retain the recorded source revision. Confirm the workflow result and a public case download before sharing new measured claims. A second person's reproduction remains a separate check.

The workflow uses GitHub's [custom Pages deployment](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The site needs no server or database.

## Recording command

A repeatable recording script is included:

```sh
npm run record:demo
```

It uses a temporary localhost server and Chrome, records actual setting changes with captions, and downloads the selected replay bundle. A local run produced `output/playwright/ecg-failure-atlas-demo.webm`. The reviewed [MP4 recording](assets/ecg-failure-atlas-demo.mp4) is 33.48 seconds at 1440 × 1000. Representative frames were checked and the downloaded bundle passed both replay modes. Temporary recording files are excluded from Git; the reviewed MP4 is included in `docs/assets/`.

## A 30-second demo story

- **0–7 s:** Open “Clipping” at 0.65 mV. Caption: “A familiar shape can hide missing information.”
- **7–14 s:** Choose 0.4 mV, then 0.9 mV. Let the actual peak-loss and plateau values remain visible. Caption: “One change. Measured amplitude loss.”
- **14–21 s:** Open Timing delay at five samples. Caption: “The same shape, 10 ms late.” Toggle the explicitly labelled alignment view.
- **21–30 s:** Download a case. Explain that the matching bundle can be replayed locally. Caption: “Download the inputs. Rerun the result.”

When recording a new version, use actual interactions after verification. Use captions and fixed axes; do not animate invented intermediate results. `docs/assets/gallery-desktop.png` is a captured working interface, not a design mockup.

## LinkedIn draft

I built ECG Failure Atlas to make a signal-processing decision inspectable.

It uses five controlled experiments to show clipping, timing delay, aliasing, baseline-filter tradeoffs and boundary effects. Every prepared setting includes the original inputs, full-resolution outputs, exact configuration and replay checks.

One example: a five-sample delay at 500 Hz preserves the waveform shape but moves its landmark by 10 ms. The demo keeps the unaligned comparison visible and labels the alignment when you choose to inspect it.

The calculations run locally in Python on Apple Silicon; the public demo is a static site. These are synthetic engineering references, not patient data or a diagnostic system.

Code: https://github.com/zakimaths/ecg-failure-atlas
Try a case: https://zakimaths.github.io/ecg-failure-atlas/#delay

## X draft

Built ECG Failure Atlas: five interactive experiments showing how preprocessing changes ECG-like signals.

Clipping. Delay. Aliasing. Filter tradeoffs.

Download the inputs, settings and outputs, then replay the result locally.

Synthetic references, no diagnoses.
https://zakimaths.github.io/ecg-failure-atlas/
