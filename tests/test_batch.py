"""Batch coverage, grouping and independent replay checks."""

from copy import deepcopy

import pytest

from ecg_atlas import batch, clinical


def test_identity_covers_each_record_and_lead_once():
    doc = batch.evaluate({**batch.DEFAULT, "cutoffs_hz": [0]})
    assert len(doc["rows"]) == 36
    assert len({(r["record"], r["lead"]) for r in doc["rows"]}) == 36
    assert len(doc["summaries"]) == 3
    assert all(r["metrics"]["rms_change_mv"] == 0 for r in doc["rows"])
    assert all(s["lead_count"] == 12 and s["median_rms_change_mv"] == 0 for s in doc["summaries"])
    assert doc["source"]["license"] == "ODC-By-1.0"
    batch.replay(doc)


def test_summary_known_values():
    rows = [{"metrics": {"rms_change_mv": v}} for v in range(12)]
    assert batch.summarize(rows) == {
        "lead_count": 12,
        "mean_rms_change_mv": 5.5,
        "median_rms_change_mv": 5.5,
        "min_rms_change_mv": 0,
        "max_rms_change_mv": 11,
    }


def test_rows_match_individual_analysis():
    c = {**batch.DEFAULT, "cutoffs_hz": [0, 20], "mode": "causal", "clip_mv": 0.4}
    doc = batch.evaluate(c)
    assert len(doc["rows"]) == 72
    assert len(doc["summaries"]) == 6
    for row in doc["rows"][::11]:
        one = clinical.evaluate(
            {
                **clinical.DEFAULT,
                "record": row["record"],
                "lead": row["lead"],
                "cutoff_hz": row["cutoff_hz"],
                "clip_mv": 0.4,
                "mode": "causal",
            }
        )
        assert row["metrics"] == one["metrics"]


@pytest.mark.parametrize("cutoffs", [[], [20, 0], [20, 20], [True], [1], list(range(8))])
def test_invalid_protocol(cutoffs):
    with pytest.raises(ValueError):
        batch.evaluate({**batch.DEFAULT, "cutoffs_hz": cutoffs})


@pytest.mark.parametrize("change", ["row", "summary", "source", "missing"])
def test_tampering_rejected(change):
    doc = deepcopy(batch.evaluate({**batch.DEFAULT, "cutoffs_hz": [0]}))
    if change == "row":
        doc["rows"][0]["metrics"]["rms_change_mv"] = 0.1
    elif change == "summary":
        doc["summaries"][0]["lead_count"] = 13
    elif change == "source":
        doc["source"]["records"][0]["files"]["dat"]["sha256"] = "changed"
    else:
        doc["rows"].pop()
    with pytest.raises(ValueError):
        batch.replay(doc)
