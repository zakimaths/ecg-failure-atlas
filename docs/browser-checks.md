# Repeat the browser checks

The repository now includes a pinned Playwright CLI suite:

```sh
npm ci --ignore-scripts
npx --no-install playwright-cli install-browser webkit
npm run check:browser
```

It runs Chrome and WebKit by default; append `-- webkit` to run only WebKit. Chrome must be installed on the Mac. The suite verifies each plotted sample and time coordinate against the exported case, checks displayed metrics and links, downloads a selected case, and exercises alignment, keyboard selection, clipboard denial, responsive sizing and offline operation. Chrome checks direct file loading with the network disabled; WebKit checks interaction on an already loaded page with the network disabled. The latter does not verify direct file navigation. Results go to `output/playwright/browser-results.json`; failures produce a nonzero process exit. `ATLAS_GALLERY=build/site npm run check:browser -- webkit` tests a freshly exported site.

Node is an optional development dependency, not part of the signal engine or hosted gallery. The pinned CLI currently includes a pinned prerelease Playwright engine; its exact version is in `package-lock.json`. Keep changes to this toolchain deliberate and rerun the suite after upgrades.

The manual checklist below remains useful for visual judgment.

Serve `gallery/` locally using the README command. Test a current Chrome and Safari on an Apple Silicon Mac. Also test a viewport approximately 390 px wide. WebKit automation is useful supporting evidence; it does not certify every Safari release or actual iPhone behavior.

1. Open each of the five navigation links. Select all three settings. The selected radio, case ID, download URL, chart and three metrics must agree.
2. Switch Overlay → Difference → Overlay. The difference chart uses its labelled units and contains one trace. Overlay-only trace visibility controls should disappear in Difference.
3. In Timing delay at five samples, enable “Remove known delay for comparison.” Its overlay should coincide with the reference; the note declares five samples and the unavailable tail. Switch to Difference: this remains the full, unaligned comparison.
4. Focus a selected setting with the keyboard and press a left/right arrow. The setting, chart, metrics and URL should update. Tab through links and controls; the first “Skip to experiment” link should focus the main region without changing the case.
5. Hide and restore a trace. Drag to zoom; choose “Reset zoom.” Neither operation changes a metric. Chart axes use each family's fixed default ranges across settings.
6. Copy a selected case link and reload/open it. The same setting should return. When clipboard access is blocked, the address must be shown as a fallback.
7. Download a case, extract it to a new folder, then run `verify` and both replay modes. The downloaded filename must match the visible case ID.
8. At 390 px wide, confirm there is no document-level horizontal overflow. The experiment navigation scrolls horizontally within its own strip. Read the entire measurement and explanation area.
9. Open the Methodology disclosure and follow the manifest link. No patient-data or diagnostic claims should appear.
10. Load `gallery/index.html` directly from disk with the network unavailable. Its local scripts and saved charts should still work. Initial Python dependency installation is a separate network-dependent step.

Observed checks and limitations are recorded in [verification.md](verification.md). The pytest suite tests numerical behavior; the Playwright CLI script tests browser wiring and interaction. CI is configured to run WebKit on the freshly exported gallery, but a remote pass must be observed separately.
