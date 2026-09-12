"""Export full-resolution computed data and a completely local static gallery."""

from pathlib import Path
import shutil
import numpy as np
from plotly.offline import get_plotlyjs
from .bundle import bundle_paths, canonical, pack_bundle, read_json, verify_case, write_json
from .cases import CATALOG


def export_gallery(root, out):
    out = Path(out)
    if out.exists():
        raise ValueError("Gallery output already exists; choose a fresh directory")
    # Validate every source before publishing any of it.
    bundles = [(path, *verify_case(path)) for path in bundle_paths(root)]
    out.mkdir(parents=True)
    (out / "bundles").mkdir()
    (out / "manifests").mkdir()
    groups = {}
    for path, manifest, arrays in bundles:
        kind = manifest["plan"]["kind"]
        groups.setdefault(kind, {**CATALOG[kind], "kind": kind, "variants": []})
        left, right = manifest["difference"]
        d = arrays[left] - arrays[right]
        variant = {
            "case_id": manifest["case_id"],
            "value": manifest["plan"]["value"],
            "metrics": read_json(path / "metrics.json"),
            "plan": manifest["plan"],
            "arrays": {name: x.tolist() for name, x in arrays.items() if name != "source"},
            "descriptors": manifest["arrays"],
            "traces": manifest["traces"],
            "difference": {
                "values": d.tolist(),
                "label": f"{left} − {right}",
                **manifest["arrays"][left],
            },
            "download": f"bundles/{path.name}.zip",
            "manifest": f"manifests/{path.name}.json",
        }
        groups[kind]["variants"].append(variant)
        pack_bundle(path, out / variant["download"])
        write_json(out / variant["manifest"], manifest)
    for group in groups.values():
        group["variants"].sort(key=lambda v: v["value"])
        group["default"] = min(group["default"], len(group["variants"]) - 1)
        group["difference_range"] = (
            max(
                0.001,
                max(float(np.max(np.abs(v["difference"]["values"]))) for v in group["variants"]),
            )
            * 1.12
        )
    data = {"schema_version": 1, "cases": list(groups.values()), "bundle_count": len(bundles)}
    # Script payload is local and trusted; escape HTML special chars for safe embedding.
    js = (
        canonical(data)
        .decode()
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )
    (out / "data.js").write_text(f"window.ATLAS_DATA={js};\n")
    (out / "plotly.min.js").write_text(get_plotlyjs())
    for file in (Path(__file__).parent / "web").iterdir():
        if file.is_file():
            shutil.copy2(file, out / file.name)
    (out / ".nojekyll").touch()
    return out
