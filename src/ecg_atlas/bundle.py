"""Self-contained payloads; hashes detect corruption, not authenticity."""

import hashlib
import io
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import zipfile

import numpy as np
import scipy
from . import __version__
from .cases import CATALOG, evaluate, resolve
from .reference import validate_signal


def canonical(value):
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False, ensure_ascii=False
    ).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_bytes(canonical(value) + b"\n")


def read_json(path):
    def invalid(value):
        raise ValueError(f"Non-standard JSON number: {value}")

    return json.loads(path.read_text(), parse_constant=invalid)


def source_info():
    root = Path(__file__).parent
    fingerprint = digest(
        b"".join(p.name.encode() + p.read_bytes() for p in sorted(root.glob("*.py")))
    )
    try:
        revision = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = bool(
            subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=root,
                capture_output=True,
                text=True,
                check=True,
            ).stdout
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        revision, dirty = None, None
    return {"revision": revision, "working_tree_dirty": dirty, "python_source_sha256": fingerprint}


def environment():
    return {
        "schema_version": 1,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "atlas": __version__,
        "byteorder": sys.byteorder,
        "source": source_info(),
        "generator": "analytic; no pseudorandom input in these five cases",
        "thread_environment": {
            k: os.environ.get(k)
            for k in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "VECLIB_MAXIMUM_THREADS")
        },
        "numpy_configuration": np.show_config(mode="dicts"),
    }


def case_identity(plan, input_hashes):
    return digest(canonical({"schema_version": 1, "plan": plan, "inputs": input_hashes}))[:20]


def save_case(parent, plan):
    result = evaluate(plan)
    payloads = {}
    for name, array in result["arrays"].items():
        buf = io.BytesIO()
        np.save(buf, np.asarray(array, dtype="<f8"), allow_pickle=False)
        payloads[f"{name}.npy"] = buf.getvalue()
    inputs = {name: digest(payloads[f"{name}.npy"]) for name in ("source", "reference", "input")}
    case_id = case_identity(plan, inputs)
    path = parent / f"{plan['kind']}-{case_id}"
    path.mkdir(parents=True, exist_ok=False)
    descriptors = {
        name: {
            **meta,
            "file": f"{name}.npy",
            "dtype": "<f8",
            "shape": list(result["arrays"][name].shape),
            "units": "mV",
        }
        for name, meta in result["descriptors"].items()
    }
    manifest = {
        "schema_version": 1,
        "case_id": case_id,
        "plan": plan,
        "input_hashes": inputs,
        "arrays": descriptors,
        "source": source_info(),
        "traces": result["traces"],
        "difference": result["difference"],
        "presentation": CATALOG[plan["kind"]],
        "provenance": {
            "reference": "Original analytic engineering fixture; not patient data",
            "code_license": "MIT",
            "external_generator_code": False,
        },
        "replay_tolerances": {"absolute": 1e-12, "relative": 1e-12},
        "landmarks": "Sampled local maxima within ±50 ms of original R-like component centers; plateau timing rule is in metrics.json",
    }
    for name, content in payloads.items():
        (path / name).write_bytes(content)
    write_json(path / "manifest.json", manifest)
    write_json(
        path / "events.json",
        {"schema_version": 1, "events": result["events"], "time_origin": "uncropped source start"},
    )
    write_json(path / "metrics.json", result["metrics"])
    write_json(path / "environment.json", environment())
    write_json(
        path / "checksums.json", {p.name: digest(p.read_bytes()) for p in sorted(path.iterdir())}
    )
    return path


def verify_case(path):
    path = Path(path)
    if path.is_symlink():
        raise ValueError("Bundle directories cannot be symlinks")
    checksums = read_json(path / "checksums.json")
    required = {
        "manifest.json",
        "events.json",
        "metrics.json",
        "environment.json",
        "source.npy",
        "reference.npy",
        "input.npy",
        "output.npy",
    }
    if not isinstance(checksums, dict) or not required.issubset(checksums):
        raise ValueError("Incomplete bundle checksums")
    actual_files = {p.name for p in path.iterdir()}
    if actual_files != set(checksums) | {"checksums.json"}:
        raise ValueError("Bundle contains missing or unexpected files")
    for name, expected in checksums.items():
        if not re.fullmatch(r"[a-z_]+\.(json|npy)", name):
            raise ValueError("Invalid payload filename")
        file = path / name
        if file.is_symlink() or not file.is_file() or file.stat().st_size > 32_000_000:
            raise ValueError("Invalid or oversized payload")
        if digest(file.read_bytes()) != expected:
            raise ValueError(f"Checksum mismatch: {name}")
    manifest = read_json(path / "manifest.json")
    if manifest["schema_version"] != 1:
        raise ValueError("Unsupported bundle schema")
    expected_id = case_identity(manifest["plan"], manifest["input_hashes"])
    if expected_id != manifest["case_id"]:
        raise ValueError("Case identity mismatch")
    for name, expected in manifest["input_hashes"].items():
        if checksums.get(f"{name}.npy") != expected:
            raise ValueError("Input identity mismatch")
    arrays = {}
    for name, meta in manifest["arrays"].items():
        if meta["file"] != f"{name}.npy" or meta["file"] not in checksums:
            raise ValueError("Invalid array descriptor")
        x = np.load(path / meta["file"], allow_pickle=False, mmap_mode="r")
        if x.dtype.str != "<f8" or x.ndim != 1 or not 0 < x.size <= 2_000_000:
            raise ValueError("Invalid array type or size")
        if list(x.shape) != meta["shape"] or meta["units"] != "mV":
            raise ValueError("Array metadata mismatch")
        if not np.isfinite([meta["fs_hz"], meta["start_s"]]).all() or meta["fs_hz"] <= 0:
            raise ValueError("Invalid sample coordinates")
        arrays[name] = validate_signal(x).copy()
    return manifest, arrays


def _compare(a, b, location="metrics"):
    if isinstance(a, dict):
        if not isinstance(b, dict) or a.keys() != b.keys():
            raise ValueError(f"Replay structure mismatch: {location}")
        for key in a:
            _compare(a[key], b[key], f"{location}.{key}")
    elif isinstance(a, list):
        if not isinstance(b, list) or len(a) != len(b):
            raise ValueError(f"Replay length mismatch: {location}")
        for i, (left, right) in enumerate(zip(a, b)):
            _compare(left, right, f"{location}[{i}]")
    elif isinstance(a, (int, float)) and not isinstance(a, bool):
        if not isinstance(b, (int, float)) or not np.isclose(a, b, atol=1e-12, rtol=1e-12):
            raise ValueError(f"Replay value mismatch: {location}")
    elif a != b:
        raise ValueError(f"Replay value mismatch: {location}")


def replay_case(path, mode):
    if mode not in ("saved-input", "regenerate"):
        raise ValueError("Replay mode must be saved-input or regenerate")
    manifest, arrays = verify_case(path)
    result = evaluate(manifest["plan"], saved=arrays if mode == "saved-input" else None)
    if arrays.keys() != result["arrays"].keys():
        raise ValueError("Replay array inventory differs")
    for name, expected in arrays.items():
        actual = result["arrays"][name]
        if actual.shape != expected.shape or not np.allclose(
            actual, expected, atol=1e-12, rtol=1e-12
        ):
            raise ValueError(f"Replay array mismatch: {name}")
    _compare(read_json(Path(path) / "metrics.json"), result["metrics"])
    if mode == "regenerate":
        _compare(read_json(Path(path) / "events.json")["events"], result["events"], "events")
    return manifest["case_id"]


def bundle_paths(root):
    root = Path(root)
    if (root / "manifest.json").is_file():
        return [root]
    index = read_json(root / "index.json")
    if index["schema_version"] != 1 or not index["bundles"]:
        raise ValueError("Invalid collection index")
    paths = []
    for name in index["bundles"]:
        if not re.fullmatch(r"[a-z]+-[0-9a-f]{20}", name):
            raise ValueError("Invalid collection bundle name")
        paths.append(root / name)
    return paths


def build_collection(recipe, out):
    data = read_json(Path(recipe))
    if data["schema_version"] != 1 or not data["cases"]:
        raise ValueError("Invalid recipe")
    plans = [resolve(case["kind"], value) for case in data["cases"] for value in case["values"]]
    if len(plans) != len({canonical(p) for p in plans}):
        raise ValueError("Recipe contains duplicate cases")
    out = Path(out)
    if out.exists():
        raise ValueError("Output already exists; choose a fresh directory to preserve evidence")
    out.mkdir(parents=True)
    paths = [save_case(out, plan) for plan in plans]
    write_json(out / "index.json", {"schema_version": 1, "bundles": [p.name for p in paths]})
    return paths


def pack_bundle(path, destination):
    verify_case(path)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(Path(path).iterdir()):
            info = zipfile.ZipInfo(file.name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes())
