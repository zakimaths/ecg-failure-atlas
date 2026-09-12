# Reproduce an experiment

## Environment

The target is native Apple Silicon macOS. `.python-version` selects CPython 3.12.12; `uv.lock` pins the dependency graph. Runtime packages are NumPy 2.2.6, SciPy 1.15.3 and Plotly.py 6.1.2. The tested package manager is uv 0.9.17. The lock includes artifact hashes. Installation requires network access or an already populated dependency cache. Subsequent calculations and the exported gallery need no network.

Use the README quickstart, from the repository root. Build into a **new** output directory every time; the CLI refuses to overwrite existing evidence. The generated `gallery/` is committed for immediate viewing. To regenerate it for a release, export into `build/site`, inspect it, then deliberately replace the generated gallery after review.

## Three distinct checks

1. **Saved-result inspection.** The gallery plots exported full-resolution arrays; it does not rerun SciPy. `verify` checks payload integrity, identity and basic schema/array invariants. It does not prove scientific correctness or origin.
2. **Saved-input replay.** Loads stored input and source/context arrays and recalculates processing and measurements, without calling the generator. Comparisons must meet the declared 1e-12 absolute/relative tolerance. Baseline corruption is stored, not recreated as a substitute for the saved input.
3. **Regeneration.** Recreates the analytic source, creates the corruption, processes the signals, and compares arrays, metrics and events. No random signals occur in version 0.1, so no seed is needed. A later noise extension must save arrays as well as a named RNG and seed.

For any of these commands, the argument may be one extracted bundle directory or a collection directory containing `index.json`:

```sh
uv run --locked ecg-atlas verify build/demo
uv run --locked ecg-atlas replay build/demo --mode saved-input
uv run --locked ecg-atlas replay build/demo --mode regenerate
```

ZIP downloads contain their files at archive root. Extract to a fresh folder using your normal archive utility. The CLI does not extract ZIP files or execute code from a bundle. It rejects symlink payloads, traversal names, extra/missing files, non-finite arrays, unexpected dtypes and oversized arrays. Hashes detect corruption, not a malicious party who replaces both data and checksums; use a trusted repository/release.

## Identity and provenance

The case ID is the first 20 hex characters of SHA-256 over canonical JSON containing schema version, the resolved scientific plan, and the SHA-256 hashes of source/reference/input NPY bytes. This is a configuration/input identity, not a guarantee that future algorithm versions give the same output. Output hashes, recorded Python source fingerprint, version, git revision (when available), and replay provide the complementary evidence.

Canonical JSON sorts keys, uses UTF-8 and compact separators, and forbids NaN/Infinity. NPY arrays are `<f8` with pickle disabled. Each payload except `checksums.json` has a SHA-256 entry. Per-case files include the manifest, events, metrics, environment and all array stages. The manifest records transform order, coefficients, sample coordinates and units.

There are no creation timestamps in scientific IDs. ZIP metadata is normalized as a convenience, but only payload hash identity is the contract. Environment files can differ by OS, numerical library, git state and machine. Whole-archive byte identity across platforms is not promised.

Before a repository exists, revision is `null`; the Python source fingerprint still identifies the code used. Rebuild release bundles from the chosen source revision before publishing a release tag. GitHub Actions runs on `macos-15` with an explicit arm64 check. The observed remote result and a replay of a published bundle are linked in [the verification record](verification.md).
