import numpy as np
import pytest
from ecg_atlas.reference import generate, timebase, validate_signal
from ecg_atlas.transforms import apply
from ecg_atlas.metrics import errors, peak
from ecg_atlas.cases import evaluate, resolve


def test_identity_and_zero_wander_are_exact():
    x = np.array([-2.0, -0.5, 0.0, 0.5, 2.0])
    for step in ({"op": "identity"}, {"op": "wander", "amplitude_mv": 0.0, "frequency_hz": 0.3}):
        y, fs = apply(x, 500, step)
        np.testing.assert_array_equal(y, x)
        assert fs == 500


def test_tiny_array_clipping_gain_and_offset():
    x = [-2.0, -0.5, 0.0, 0.5, 2.0]
    np.testing.assert_array_equal(
        apply(x, 500, {"op": "clip", "limit_mv": 1})[0], [-1, -0.5, 0, 0.5, 1]
    )
    np.testing.assert_array_equal(apply(x, 500, {"op": "gain", "value": 2})[0], [-4, -1, 0, 1, 4])
    np.testing.assert_array_equal(
        apply(x, 500, {"op": "offset", "value": 1})[0], [-1, 0.5, 1, 1.5, 3]
    )


def test_delay_is_ten_milliseconds_and_never_wraps():
    x = np.zeros(40)
    x[10], x[-1] = 1, 2
    y, fs = apply(x, 500, {"op": "delay", "samples": 5})
    expected = np.zeros(40)
    expected[15] = 1
    np.testing.assert_array_equal(y, expected)
    assert (np.argmax(y) - 10) / fs * 1000 == 10
    np.testing.assert_array_equal(apply(x, 500, {"op": "delay", "samples": 0})[0], x)


def test_fir_impulse_and_independent_tone_response():
    x = np.zeros(80)
    x[20] = 1
    step = {"op": "fir", "coefficients": [0.25, 0.5, 0.25]}
    y, _ = apply(x, 100, step)
    expected = np.zeros(80)
    expected[20:23] = [0.25, 0.5, 0.25]
    np.testing.assert_array_equal(y, expected)
    assert np.argmax(y) - np.argmax(x) == 1
    n = np.arange(1000)
    omega = 2 * np.pi * 0.1
    y, _ = apply(np.sin(omega * n), 100, step)
    # H(w) = exp(-iw) * cos(w/2)^2, derived independently from three coefficients.
    expected = np.cos(omega / 2) ** 2 * np.sin(omega * (n - 1))
    np.testing.assert_allclose(y[2:], expected[2:], atol=1e-13, rtol=0)


def test_alias_has_expected_sign_and_antialias_suppresses_it():
    result = evaluate(resolve("aliasing", 101))
    y = result["arrays"]["output"]
    expected = -np.sin(2 * np.pi * 20 * np.arange(400) / 100)
    np.testing.assert_allclose(y, expected, atol=3e-13, rtol=0)
    assert np.sqrt(np.mean(result["arrays"]["antialias"][50:-50] ** 2)) < 1e-4
    assert result["descriptors"]["input"]["fs_hz"] == 500
    assert result["descriptors"]["output"]["fs_hz"] == 100


def test_known_error_and_plateau_definition():
    m = errors([0, 0, 0, 0], [0, 3, 4, 0], 10, 1, 3)
    assert m["rmse_mv"] == np.sqrt(12.5)
    assert m["max_abs_error_mv"] == 4
    assert m["window_s"] == [0.1, 0.3]
    p = peak([0, 0, 1, 1, 1, 0, 0], 10, 0.3)
    assert p["time_s"] == 0.3
    assert p["span_ms"] == 200


def test_reference_landmarks_are_actual_sampled_maxima():
    x, events = generate({"kind": "ecg_like", "fs_hz": 500, "duration_s": 8})
    assert len(x) == 4000 and len(events) == 7
    for event in events:
        i = event["index"]
        assert x[i] == max(x[i - 20 : i + 21])
        assert event["time_s"] == i / 500


def test_baseline_clean_branch_and_edge_context_are_distinct():
    result = evaluate(resolve("baseline", 0.5))
    assert not np.array_equal(result["arrays"]["reference"], result["arrays"]["clean_output"])
    d = result["metrics"]["details"]
    assert d["corrected_error"]["rmse_mv"] < d["raw_error"]["rmse_mv"]
    assert d["clean_error"]["rmse_mv"] > 0
    edge = evaluate(resolve("edges", 20.0))
    h = edge["metrics"]["headline"]
    assert h[0]["value"] > h[1]["value"]
    assert edge["descriptors"]["output"]["start_s"] == 2.696


@pytest.mark.parametrize("bad", [[], [[1, 2]], [np.nan], [np.inf]])
def test_invalid_signals(bad):
    with pytest.raises(ValueError):
        validate_signal(bad)


@pytest.mark.parametrize(
    "step",
    [
        {"op": "clip", "limit_mv": -1},
        {"op": "delay", "samples": -1},
        {"op": "delay", "samples": 5},
        {"op": "delay", "samples": 0.5},
        {"op": "lowpass", "cutoff_hz": 250, "order": 2},
        {"op": "resample_poly", "factor": 0},
        {"op": "exec"},
    ],
)
def test_invalid_transforms(step):
    with pytest.raises(ValueError):
        apply([1, 2, 3, 4, 5], 500, step)


@pytest.mark.parametrize("fs,duration", [(0, 2), (500, 0), (np.inf, 2), (500, np.nan)])
def test_invalid_timebases(fs, duration):
    with pytest.raises(ValueError):
        timebase(fs, duration)


def test_forward_backward_magnitude_is_squared_for_first_order_filter():
    fs = 500
    n = np.arange(12000)
    frequency, cutoff = 30.0, 20.0
    x = np.sin(2 * np.pi * frequency * n / fs)
    y, _ = apply(
        x,
        fs,
        {
            "op": "lowpass",
            "cutoff_hz": cutoff,
            "order": 1,
            "mode": "forward_backward",
            "padlen": 27,
        },
    )
    # Bilinear-transformed first-order Butterworth: |H|^2 = 1/(1+(tan(w/2)/tan(wc/2))^2).
    gain = 1 / (1 + (np.tan(np.pi * frequency / fs) / np.tan(np.pi * cutoff / fs)) ** 2)
    np.testing.assert_allclose(y[1000:-1000], gain * x[1000:-1000], atol=4e-13, rtol=0)
