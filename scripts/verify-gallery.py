"""Verify that the static gallery, manifests and downloadable evidence agree."""

import argparse
import json
from pathlib import Path
import re
import tempfile
import zipfile

import numpy as np

from ecg_atlas.bundle import read_json, replay_case, verify_case


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gallery", type=Path, nargs="?", default=Path("gallery"))
    args = parser.parse_args()
    content = (args.gallery / "data.js").read_text()
    if not content.startswith("window.ATLAS_DATA=") or not content.endswith(";\n"):
        raise ValueError("Unexpected gallery data format")
    data = json.loads(content.removeprefix("window.ATLAS_DATA=")[:-2])
    count = 0
    with tempfile.TemporaryDirectory(prefix="ecg-gallery-") as temporary:
        for group in data["cases"]:
            for variant in group["variants"]:
                folder = Path(temporary) / variant["case_id"]
                folder.mkdir()
                download = variant["download"]
                if not re.fullmatch(r"bundles/[a-z]+-[0-9a-f]{20}\.zip", download):
                    raise ValueError("Invalid download path")
                with zipfile.ZipFile(args.gallery / download) as archive:
                    names = archive.namelist()
                    if len(names) != len(set(names)):
                        raise ValueError("Duplicate ZIP payload names")
                    for item in archive.infolist():
                        if not re.fullmatch(r"[a-z_]+\.(json|npy)", item.filename):
                            raise ValueError("Unsafe ZIP payload name")
                        if item.file_size > 32_000_000:
                            raise ValueError("Oversized ZIP payload")
                        (folder / item.filename).write_bytes(archive.read(item))
                manifest, arrays = verify_case(folder)
                assert manifest["case_id"] == variant["case_id"]
                manifest_path = variant["manifest"]
                assert re.fullmatch(r"manifests/[a-z]+-[0-9a-f]{20}\.json", manifest_path)
                assert read_json(args.gallery / manifest_path) == manifest
                assert read_json(folder / "metrics.json") == variant["metrics"]
                assert manifest["plan"] == variant["plan"]
                assert manifest["arrays"] == variant["descriptors"]
                assert manifest["traces"] == variant["traces"]
                assert set(variant["arrays"]) == set(arrays) - {"source"}
                for name, values in variant["arrays"].items():
                    np.testing.assert_array_equal(values, arrays[name])
                left, right = manifest["difference"]
                np.testing.assert_array_equal(
                    variant["difference"]["values"], arrays[left] - arrays[right]
                )
                replay_case(folder, "saved-input")
                replay_case(folder, "regenerate")
                count += 1
    assert count == data["bundle_count"] == 15
    print(f"PASS: {count} gallery variants match their downloads, manifests and both replay modes")


if __name__ == "__main__":
    main()
