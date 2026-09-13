"""Controlled timing, matching, polarity and replay checks for beat candidates."""

from copy import deepcopy

import numpy as np
import pytest

from ecg_atlas import beats, clinical


def pulses():
    x = np.arange(8000)
    return sum(np.exp(-0.5 * ((x - p) / 9) ** 2) for p in range(1500, 6501, 1000))


def test_known_pulses_and_delay():
    x = pulses()
    y = np.concatenate((np.zeros(30), x[:-30]))
    d = beats.analyze({"recorded": x, "output": y}, beats.DEFAULT, 30)
    assert d["recorded_peaks"] == list(range(1500, 6501, 1000))
    assert d["output_peaks"] == list(range(1530, 6531, 1000))
    assert len(d["matches"]) == 6
    assert d["median_shift_ms"] == 30
    assert d["median_adjusted_shift_ms"] == 0
    assert d["recorded_rate_bpm"] == d["output_rate_bpm"] == 60
    assert not d["recorded_only"] and not d["output_only"]


def test_silence_and_insufficient_intervals():
    d = beats.analyze({"recorded": np.zeros(8000), "output": np.zeros(8000)}, beats.DEFAULT, 0)
    assert d["recorded_peaks"] == d["output_peaks"] == d["matches"] == []
    assert d["recorded_rate_bpm"] is d["rate_change_bpm"] is d["median_shift_ms"] is None
    assert beats.rate([1000]) is None


def test_polarity_invariance_and_shared_threshold():
    x = pulses()
    d = beats.analyze({"recorded": x, "output": -x}, beats.DEFAULT, 0)
    assert d["recorded_peaks"] == d["output_peaks"]
    assert d["median_shift_ms"] == 0
    attenuated = beats.analyze({"recorded": x, "output": x * 0.1}, beats.DEFAULT, 0)
    assert attenuated["output_peaks"] == []
    assert attenuated["recorded_only"] == d["recorded_peaks"]
    assert attenuated["threshold_score_units"] == d["threshold_score_units"]


def test_identity_on_recorded_data():
    doc = beats.evaluate({**clinical.DEFAULT, "cutoff_hz": 0}, beats.DEFAULT)
    d = doc["detection"]
    assert len(d["matches"]) > 0
    assert d["recorded_peaks"] == d["output_peaks"]
    assert d["rate_change_bpm"] == d["median_shift_ms"] == 0
    assert min(np.diff(d["recorded_peaks"])) >= beats.DEFAULT["refractory_ms"]
    beats.replay(doc)


def test_matching_maximum_cardinality_then_minimum_cost():
    pairs = beats.pair([100, 200], [190, 290], 0, 100)
    assert [(p["recorded_sample"], p["output_sample"]) for p in pairs] == [(100, 190), (200, 290)]
    assert beats.pair([100], [80, 105], 0, 20)[0]["output_sample"] == 105
    assert beats.pair([100], [120], 0, 20)[0]["adjusted_shift_ms"] == 20
    assert beats.pair([100], [121], 0, 20) == []
    assert beats.pair([], [100], 0, 20) == []


@pytest.mark.parametrize(
    "key,value",
    [
        ("threshold_ratio", 0),
        ("threshold_ratio", True),
        ("threshold_ratio", float("nan")),
        ("refractory_ms", 250.5),
        ("match_ms", 151),
    ],
)
def test_invalid_detector_settings(key, value):
    with pytest.raises(ValueError):
        beats.validate({**beats.DEFAULT, key: value})


@pytest.mark.parametrize(
    "field",
    ["recorded_peaks", "recorded_score_units", "threshold_score_units", "source", "settings"],
)
def test_tampering_rejected(field):
    doc = deepcopy(beats.evaluate(clinical.DEFAULT, beats.DEFAULT))
    if field == "source":
        doc["analysis"]["arrays"]["recorded"][0] += 0.1
    elif field == "settings":
        doc["detector"]["threshold_ratio"] = 0.4
    elif field == "threshold_score_units":
        doc["detection"][field] += 100
    else:
        doc["detection"][field][0] += 1
    with pytest.raises(ValueError):
        beats.replay(doc)
