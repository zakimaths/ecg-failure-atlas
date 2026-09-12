from pathlib import Path
import json
import zipfile
import numpy as np
import pytest
from ecg_atlas.bundle import (
    build_collection,
    save_case,
    verify_case,
    replay_case,
    resolve,
    canonical,
    digest,
    write_json,
    bundle_paths,
)
from ecg_atlas.export import export_gallery
from ecg_atlas.cases import CATALOG


@pytest.mark.parametrize(
    "kind,value", [(k, v) for k, meta in CATALOG.items() for v in meta["values"]]
)
def test_all_prepared_cases_replay_in_both_modes(tmp_path, kind, value):
    folder = save_case(tmp_path, resolve(kind, value))
    manifest, arrays = verify_case(folder)
    assert arrays["output"].dtype == np.dtype("float64")
    assert replay_case(folder, "saved-input") == manifest["case_id"]
    assert replay_case(folder, "regenerate") == manifest["case_id"]


def test_saved_input_does_not_call_generator(tmp_path, monkeypatch):
    folder = save_case(tmp_path, resolve("baseline", 0.5))

    def forbidden(_):
        raise AssertionError("Saved-input replay regenerated reference")

    monkeypatch.setattr("ecg_atlas.cases.generate", forbidden)
    replay_case(folder, "saved-input")


def test_corruption_unexpected_files_and_traversal_fail(tmp_path):
    folder = save_case(tmp_path, resolve("clipping", 0.65))
    original = (folder / "output.npy").read_bytes()
    (folder / "output.npy").write_bytes(original[:-1] + b"x")
    with pytest.raises(ValueError, match="Checksum"):
        verify_case(folder)
    (folder / "output.npy").write_bytes(original)
    (folder / "extra.txt").write_text("unexpected")
    with pytest.raises(ValueError, match="unexpected"):
        verify_case(folder)
    (folder / "extra.txt").unlink()
    checksums = json.loads((folder / "checksums.json").read_text())
    checksums["../outside.npy"] = "test"
    write_json(folder / "checksums.json", checksums)
    with pytest.raises(ValueError):
        verify_case(folder)


def test_scientific_id_is_stable_and_setting_sensitive(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir()
    b.mkdir()
    first = save_case(a, resolve("delay", 5))
    same = save_case(b, resolve("delay", 5))
    other = save_case(a, resolve("delay", 12))
    assert first.name == same.name != other.name
    for name in ("source.npy", "input.npy", "output.npy", "metrics.json"):
        assert (first / name).read_bytes() == (same / name).read_bytes()


def test_changed_metrics_are_detected_even_if_rehashed(tmp_path):
    folder = save_case(tmp_path, resolve("delay", 5))
    file = folder / "metrics.json"
    metrics = json.loads(file.read_text())
    metrics["headline"][0]["value"] = 17
    write_json(file, metrics)
    checksums = json.loads((folder / "checksums.json").read_text())
    checksums[file.name] = digest(file.read_bytes())
    write_json(folder / "checksums.json", checksums)
    with pytest.raises(ValueError, match="Replay value mismatch"):
        replay_case(folder, "saved-input")


def test_export_contains_offline_assets_and_matching_download(tmp_path):
    recipe = tmp_path / "recipe.json"
    write_json(recipe, {"schema_version": 1, "cases": [{"kind": "clipping", "values": [0.65]}]})
    root = tmp_path / "collection"
    paths = build_collection(recipe, root)
    assert bundle_paths(root) == paths
    out = export_gallery(root, tmp_path / "gallery")
    for name in ("index.html", "app.js", "style.css", "plotly.min.js", "data.js", ".nojekyll"):
        assert (out / name).is_file()
    payload = (out / "data.js").read_text().removeprefix("window.ATLAS_DATA=").rstrip(";\n")
    data = json.loads(payload)
    variant = data["cases"][0]["variants"][0]
    np.testing.assert_array_equal(variant["arrays"]["output"], np.load(paths[0] / "output.npy"))
    with zipfile.ZipFile(out / variant["download"]) as archive:
        for name in archive.namelist():
            assert Path(name).name == name
            assert archive.read(name) == (paths[0] / name).read_bytes()
    with pytest.raises(ValueError, match="already exists"):
        build_collection(recipe, root)


def test_canonical_json_rejects_nan():
    with pytest.raises(ValueError):
        canonical({"bad": float("nan")})
