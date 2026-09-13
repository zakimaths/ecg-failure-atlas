import copy

import numpy as np
import pytest

from ecg_atlas import live


def test_identity_has_no_error_and_preserves_every_sample():
    r = live.evaluate({**live.DEFAULT, "noise_mv": 0, "cutoff_hz": 0})
    assert r["arrays"]["reference"] == r["arrays"]["output"] == r["arrays"]["clean"]
    assert all(value == 0 for value in r["metrics"].values())
    assert live.replay(r)["metrics"] == r["metrics"]


def test_noise_seed_has_known_integer_states_and_repeats():
    integers = [270369, 67634689, 2647435461]
    expected = (np.asarray(integers) / 4294967296 * 2 - 1) * np.sqrt(3)
    np.testing.assert_array_equal(live.noise(1, 3), expected)
    np.testing.assert_array_equal(live.noise(42), live.noise(42))
    assert not np.array_equal(live.noise(42), live.noise(43))
    assert np.max(np.abs(live.noise(1))) <= np.sqrt(3)


def test_impulse_delay_centering_and_zero_boundary():
    x = np.zeros(20)
    x[10] = 1
    b = np.array([0.25, 0.5, 0.25])
    config = {**live.DEFAULT, "mode": "causal"}
    causal = live.process(x, config, b)
    expected = np.zeros(20)
    expected[10:13] = b
    np.testing.assert_array_equal(causal, expected)
    centered = live.process(x, {**config, "mode": "centered"}, b)
    assert np.argmax(centered) == 10
    np.testing.assert_array_equal(centered[9:12], b)
    x = np.zeros(20)
    x[-1] = 1
    y = live.process(x, {**config, "mode": "centered"}, b)
    assert y[-2:].tolist() == [0.25, 0.5]
    assert y[0] == 0


def test_known_fir_gain_and_phase():
    f = np.array([0, 10, 50, 100])
    w = 2 * np.pi * f / 500
    b = np.array([0.25, 0.5, 0.25])
    expected = np.cos(w / 2) ** 2
    np.testing.assert_allclose(live.response(b, "causal", f), expected * np.exp(-1j * w))
    np.testing.assert_allclose(live.response(b, "centered", f), expected, atol=1e-15)


def test_filter_is_symmetric_normalized_and_clean_change_is_real():
    b = live.coefficients(live.DEFAULT)
    np.testing.assert_allclose(b, b[::-1], atol=1e-15, rtol=0)
    assert np.sum(b) == pytest.approx(1, abs=1e-15)
    r = live.evaluate(live.DEFAULT)
    assert r["metrics"]["output_rmse_mv"] < r["metrics"]["input_rmse_mv"]
    assert r["metrics"]["clean_rmse_mv"] > 0
    assert r["metrics"]["filter_delay_ms"] == 0
    assert live.evaluate({**live.DEFAULT, "mode": "causal"})["metrics"]["filter_delay_ms"] == 60


def test_error_decomposition_keeps_the_cross_term():
    r = live.evaluate({**live.DEFAULT, "clip_mv": 0.4, "wander_mv": 0.4})
    m = r["metrics"]
    assert abs(m["cross_term_mv2"]) > 1e-4
    assert m["total_mse_mv2"] == pytest.approx(
        m["clean_mse_mv2"] + m["corruption_mse_mv2"] + m["cross_term_mv2"], abs=1e-15
    )


@pytest.mark.parametrize("field", ["output", "clean", "reference", "input"])
def test_regeneration_rejects_changed_samples(field):
    r = live.evaluate(live.DEFAULT)
    r["arrays"][field][1234] += 0.001
    with pytest.raises(ValueError, match="Replay mismatch"):
        live.replay(r)


def test_saved_input_replay_does_not_regenerate(monkeypatch):
    r = live.evaluate(live.DEFAULT)

    def fail(*args):
        raise AssertionError("Generator called in saved-input mode")

    monkeypatch.setattr(live, "generate", fail)
    monkeypatch.setattr(live, "noise", fail)
    live.replay(r, "saved-input")


@pytest.mark.parametrize("field", ["coefficients", "metrics"])
def test_replay_rejects_changed_coefficients_or_metrics(field):
    r = live.evaluate(live.DEFAULT)
    if field == "coefficients":
        r[field][2] += 0.001
    else:
        r[field]["output_rmse_mv"] += 0.001
    with pytest.raises(ValueError, match="Replay mismatch"):
        live.replay(r)


@pytest.mark.parametrize(
    "change",
    [
        {"seed": 0},
        {"seed": True},
        {"seed": 1.5},
        {"seed": 4294967296},
        {"noise_mv": float("nan")},
        {"noise_mv": -1},
        {"cutoff_hz": 250},
        {"cutoff_hz": 1},
        {"taps": 32},
        {"mode": "unknown"},
        {"clip_mv": 0.05},
        {"extra": 1},
    ],
)
def test_invalid_settings(change):
    with pytest.raises(ValueError):
        live.evaluate({**live.DEFAULT, **change})


def test_bad_document_shape_nonfinite_and_file_limit(tmp_path):
    r = live.evaluate(live.DEFAULT)
    for bad in ({}, {**r, "fs_hz": 250}, {**r, "analysis_samples": [0, 4000]}):
        with pytest.raises(ValueError):
            live.replay(bad)
    for value in (True, float("nan"), "0.2", 10**400, 1e200):
        bad = copy.deepcopy(r)
        bad["arrays"]["input"][0] = value
        with pytest.raises(ValueError):
            live.replay(bad)
    path = tmp_path / "large.json"
    path.write_bytes(b" " * 2_000_001)
    with pytest.raises(ValueError, match="2 MB"):
        live.read_experiment(path)
