"""Detector sweep coverage, fixed thresholds and reproducible row checks."""

from copy import deepcopy

import pytest

from ecg_atlas import beats, clinical, stress


def protocol(cutoffs):
    return {
        **deepcopy(stress.DEFAULT),
        "processing": {**stress.DEFAULT["processing"], "cutoffs_hz": cutoffs},
    }


def test_identity_covers_every_lead():
    doc = stress.evaluate(protocol([0]))
    assert len(doc["rows"]) == 36
    assert len({(r["record"], r["lead"]) for r in doc["rows"]}) == 36
    for row in doc["rows"]:
        d = row["detection"]
        assert d["recorded_peaks"] == d["output_peaks"]
        assert not d["recorded_only"] and not d["output_only"]
        assert d["median_adjusted_shift_ms"] in (None, 0)
        assert "recorded_score_units" not in d
    assert doc["source"]["license"] == "ODC-By-1.0"
    stress.replay(doc)


def test_threshold_fixed_across_cutoffs_and_individual_equivalence():
    c = protocol([0, 12])
    c["processing"].update({"mode": "causal", "clip_mv": 0.4, "taps": 101})
    c["detector"].update({"threshold_ratio": 0.4, "match_ms": 50})
    doc = stress.evaluate(c)
    for a, b in zip(doc["rows"][:36], doc["rows"][36:], strict=True):
        assert a["detection"]["threshold_score_units"] == b["detection"]["threshold_score_units"]
        assert a["detection"]["recorded_peaks"] == b["detection"]["recorded_peaks"]
    row = doc["rows"][37]
    analysis = {
        **clinical.DEFAULT,
        "record": row["record"],
        "lead": row["lead"],
        "cutoff_hz": row["cutoff_hz"],
        **{k: c["processing"][k] for k in ("mode", "clip_mv", "taps")},
    }
    d = beats.evaluate(analysis, c["detector"])["detection"]
    assert row["detection"] == {k: v for k, v in d.items() if k not in stress.OMIT}


@pytest.mark.parametrize(
    "field", ["rows", "source", "filters", "candidate", "rate", "method", "quantum"]
)
def test_changed_evidence_rejected(field):
    doc = stress.evaluate(protocol([0]))
    if field == "rows":
        doc["rows"].pop()
    elif field == "source":
        doc["source"]["license"] = "MIT"
    elif field == "filters":
        doc["filters"][0]["coefficients"][0] = 0.5
    elif field == "candidate":
        doc["rows"][0]["detection"]["recorded_peaks"][0] += 1
    elif field == "quantum":
        doc["method"]["score_quantum_mv2"] = 2e-12
    elif field == "method":
        doc["method"]["name"] = "other"
    else:
        doc["rows"][0]["detection"]["rate_change_bpm"] = 10
    with pytest.raises(ValueError):
        stress.replay(doc)


@pytest.mark.parametrize(
    "config",
    [
        {},
        {"processing": {}},
        {"processing": stress.DEFAULT["processing"], "detector": {"threshold_ratio": 0}},
    ],
)
def test_invalid_settings(config):
    with pytest.raises(ValueError):
        stress.evaluate(config)
