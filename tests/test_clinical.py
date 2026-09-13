"""Clinical source integrity and processing/replay invariants."""

from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

from ecg_atlas import clinical

ROOT = Path(__file__).resolve().parents[1]


def test_subset_is_pinned():
    data = clinical.dataset()
    lock = json.loads((clinical.DATA_PATH.parent / "ptb-source-lock.json").read_text())
    assert {k: v for k, v in data.items() if k != "records"} == {
        k: v for k, v in lock.items() if k != "records"
    }
    for record, pinned in zip(data["records"], lock["records"], strict=True):
        assert {k: v for k, v in record.items() if k != "digital"} == pinned
        assert len(record["digital"]) == 12
        for samples in record["digital"].values():
            assert len(samples) == 8000
            assert all(isinstance(v, int) and -32768 < v <= 32767 for v in samples)
    expected = (clinical.DATA_PATH.parent / "ptb-subset.sha256").read_text().split()[0]
    assert hashlib.sha256(clinical.DATA_PATH.read_bytes()).hexdigest() == expected


@pytest.mark.parametrize("record", [r["id"] for r in clinical.dataset()["records"]])
def test_identity_all_leads(record):
    for lead in clinical.dataset()["records"][0]["digital"]:
        doc = clinical.evaluate(
            {**clinical.DEFAULT, "record": record, "lead": lead, "cutoff_hz": 0}
        )
        assert doc["arrays"]["recorded"] == doc["arrays"]["output"]
        assert doc["metrics"]["rms_change_mv"] == 0
        assert doc["metrics"]["max_abs_change_mv"] == 0
        clinical.replay(doc)


def test_delay_and_alignment():
    x = np.zeros(8000)
    x[2000] = 1
    y = np.zeros(8000)
    y[2030] = 1
    result = clinical.measure(x, y, 30)
    assert result["filter_delay_ms"] == 30
    assert result["aligned_rms_change_mv"] == 0
    assert result["rms_change_mv"] == pytest.approx(np.sqrt(2 / 6000))
    assert result["max_abs_change_mv"] == 1


def test_native_rate_and_filter_placement():
    centered = clinical.evaluate(clinical.DEFAULT)
    causal = clinical.evaluate({**clinical.DEFAULT, "mode": "causal"})
    b = centered["coefficients"]
    assert sum(b) == pytest.approx(1)
    assert b == pytest.approx(b[::-1])
    assert causal["metrics"]["filter_delay_ms"] == 30
    assert causal["arrays"]["output"][30:] == centered["arrays"]["output"][:-30]
    assert causal["metrics"]["aligned_rms_change_mv"] == centered["metrics"]["rms_change_mv"]
    assert centered["arrays"]["recorded"][0] == -458 / 2000


@pytest.mark.parametrize(
    "field", ["sample", "metadata", "coefficient", "metric", "schema", "extra"]
)
def test_tampered_export_rejected(field):
    doc = deepcopy(clinical.evaluate(clinical.DEFAULT))
    if field == "sample":
        doc["arrays"]["recorded"][5] += 0.001
    elif field == "metadata":
        doc["source"]["license"] = "MIT"
    elif field == "coefficient":
        doc["coefficients"][0] += 0.01
    elif field == "metric":
        doc["metrics"]["rms_change_mv"] = float("nan")
    elif field == "schema":
        doc["schema"] = "ecg-atlas-live/1"
    else:
        doc["extra"] = True
    with pytest.raises(ValueError):
        clinical.replay(doc)


@pytest.mark.parametrize(
    "key,value",
    [
        ("record", "unknown"),
        ("lead", "__proto__"),
        ("cutoff_hz", True),
        ("cutoff_hz", 1000),
        ("clip_mv", 0.01),
        ("taps", 32),
    ],
)
def test_invalid_settings(key, value):
    with pytest.raises(ValueError):
        clinical.evaluate({**clinical.DEFAULT, key: value})


def test_format16_decoder_and_corruption():
    spec = importlib.util.spec_from_file_location("prepare_ptb", ROOT / "scripts/prepare-ptb.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Construct signed bytes independently of the array decoder.
    import struct

    values = [-1000, -1, 0, 1, 2, 3, 4, 100, 1000, 2000, 3000, 32000]
    raw = struct.pack("<12h", *values) * 8000
    header = "fixture 15 1000 8000\n" + "\n".join(
        f"fixture.dat 16 2000 16 0 {v} {(v * 8000) % 65536} 0 {lead}"
        for v, lead in zip(values, module.LEADS, strict=True)
    )
    decoded = module.decode(header.encode(), raw)
    assert decoded == {lead: [v] * 8000 for lead, v in zip(module.LEADS, values, strict=True)}
    with pytest.raises(ValueError, match="checksum"):
        module.decode(header.encode(), raw[:-1] + bytes([raw[-1] ^ 1]))
    with pytest.raises(ValueError, match="encoding"):
        module.decode(header.replace("2000", "1000", 1).encode(), raw)
