"""A fixed-subset processing benchmark; lead summaries are descriptive, not inference."""

from copy import deepcopy

from . import clinical

SCHEMA = "ecg-atlas-batch/1"
LEADS = ["i", "ii", "iii", "avr", "avl", "avf", "v1", "v2", "v3", "v4", "v5", "v6"]
DEFAULT = {"clip_mv": 0, "cutoffs_hz": [0, 12, 20, 35, 50, 100], "taps": 61, "mode": "centered"}


def validate(config, data):
    if not isinstance(config, dict) or set(config) != set(DEFAULT):
        raise ValueError("Unexpected batch settings")
    cutoffs = config["cutoffs_hz"]
    if not isinstance(cutoffs, list) or not 1 <= len(cutoffs) <= 7:
        raise ValueError("Use one to seven distinct ascending cutoffs")
    for cutoff in cutoffs:
        clinical.validate(
            {
                **clinical.DEFAULT,
                "clip_mv": config["clip_mv"],
                "taps": config["taps"],
                "mode": config["mode"],
                "cutoff_hz": cutoff,
            },
            data,
        )
    if sorted(set(cutoffs)) != cutoffs:
        raise ValueError("Cutoffs must be distinct and ascending")


def source(data):
    return {
        **{k: v for k, v in data.items() if k != "records"},
        "records": [{k: v for k, v in r.items() if k != "digital"} for r in data["records"]],
    }


def summarize(rows):
    values = sorted(r["metrics"]["rms_change_mv"] for r in rows)
    return {
        "lead_count": len(values),
        "mean_rms_change_mv": sum(values) / len(values),
        "median_rms_change_mv": (values[5] + values[6]) / 2,
        "min_rms_change_mv": values[0],
        "max_rms_change_mv": values[-1],
    }


def evaluate(config, data=None):
    data = clinical.dataset() if data is None else data
    validate(config, data)
    rows, summaries, filters = [], [], []
    for cutoff in config["cutoffs_hz"]:
        for record in data["records"]:
            group = []
            for lead in LEADS:
                c = {
                    "record": record["id"],
                    "lead": lead,
                    "cutoff_hz": cutoff,
                    **{k: config[k] for k in ("clip_mv", "taps", "mode")},
                }
                result = clinical.evaluate(c, data)
                row = {
                    "record": record["id"],
                    "lead": lead,
                    "cutoff_hz": cutoff,
                    "metrics": result["metrics"],
                }
                rows.append(row)
                group.append(row)
            summaries.append({"record": record["id"], "cutoff_hz": cutoff, **summarize(group)})
        filters.append({"cutoff_hz": cutoff, "coefficients": result["coefficients"]})
    return {
        "schema": SCHEMA,
        "config": deepcopy(config),
        "source": source(data),
        "fs_hz": clinical.FS,
        "analysis_samples": clinical.WINDOW.copy(),
        "leads": LEADS.copy(),
        "filters": filters,
        "rows": rows,
        "summaries": summaries,
    }


def replay(document):
    if not isinstance(document, dict) or document.get("schema") != SCHEMA:
        raise ValueError("Unknown batch format")
    expected = evaluate(document.get("config"))
    clinical.compare(document, expected)
    return expected
