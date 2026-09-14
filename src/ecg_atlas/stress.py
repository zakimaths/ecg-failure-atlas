"""Repeat the fixed detector across recorded leads and processing cutoffs."""

from copy import deepcopy

from . import batch, beats, clinical

SCHEMA = "ecg-atlas-stress/1"
DEFAULT = {"processing": deepcopy(batch.DEFAULT), "detector": deepcopy(beats.DEFAULT)}
OMIT = {"method", "analysis_samples", "recorded_score_units", "output_score_units"}


def validate(config, data):
    if not isinstance(config, dict) or set(config) != set(DEFAULT):
        raise ValueError("Unexpected sweep settings")
    batch.validate(config["processing"], data)
    beats.validate(config["detector"])


def evaluate(config, data=None):
    data = clinical.dataset() if data is None else data
    validate(config, data)
    rows, filters = [], []
    c = config["processing"]
    for cutoff in c["cutoffs_hz"]:
        for record in data["records"]:
            for lead in batch.LEADS:
                analysis = clinical.evaluate(
                    {
                        "record": record["id"],
                        "lead": lead,
                        "cutoff_hz": cutoff,
                        **{k: c[k] for k in ("clip_mv", "taps", "mode")},
                    },
                    data,
                )
                detection = beats.analyze(
                    analysis["arrays"],
                    config["detector"],
                    int(analysis["metrics"]["filter_delay_ms"]),
                )
                rows.append(
                    {
                        "record": record["id"],
                        "lead": lead,
                        "cutoff_hz": cutoff,
                        "detection": {k: v for k, v in detection.items() if k not in OMIT},
                    }
                )
        filters.append({"cutoff_hz": cutoff, "coefficients": analysis["coefficients"]})
    return {
        "schema": SCHEMA,
        "config": deepcopy(config),
        "source": batch.source(data),
        "method": deepcopy(beats.METHOD),
        "fs_hz": clinical.FS,
        "analysis_samples": clinical.WINDOW.copy(),
        "leads": batch.LEADS.copy(),
        "filters": filters,
        "rows": rows,
    }


def replay(document):
    if not isinstance(document, dict) or document.get("schema") != SCHEMA:
        raise ValueError("Unknown detector sweep format")
    if document.get("method") != beats.METHOD:
        raise ValueError("Detector method mismatch")
    expected = evaluate(document.get("config"))
    clinical.compare(document, expected)
    return expected
