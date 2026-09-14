"""Small command interface. All numerical operations run locally."""

import argparse
import sys
from .bundle import build_collection, bundle_paths, replay_case, verify_case
from .export import export_gallery


def main():
    parser = argparse.ArgumentParser(
        prog="ecg-atlas", description="Build and replay ECG-like distortion experiments"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("build", "export-gallery"):
        p = commands.add_parser(name)
        p.add_argument("source")
        p.add_argument("--out", required=True)
    for name in ("verify", "replay"):
        p = commands.add_parser(name)
        p.add_argument("source")
        if name == "replay":
            p.add_argument("--mode", choices=("saved-input", "regenerate"), required=True)
    p = commands.add_parser("run-live", help="Calculate a custom experiment from a settings JSON")
    p.add_argument("source")
    p.add_argument("--out", required=True)
    p = commands.add_parser("replay-live", help="Check a custom browser experiment JSON")
    p.add_argument("source")
    p.add_argument("--mode", choices=("saved-input", "regenerate"), required=True)
    p = commands.add_parser(
        "replay-clinical", help="Verify a hospital-recording experiment against the pinned source"
    )
    p.add_argument("source")
    for name in ("run-batch", "replay-batch"):
        p = commands.add_parser(name, help="Run or independently replay the fixed clinical batch")
        p.add_argument("source")
        if name == "run-batch":
            p.add_argument("--out", required=True)
    p = commands.add_parser("replay-beats", help="Independently check a beat-detection comparison")
    p.add_argument("source")
    for name in ("run-stress", "replay-stress"):
        p = commands.add_parser(name, help="Run or replay the detector sweep")
        p.add_argument("source")
        if name == "run-stress":
            p.add_argument("--out", required=True)
    args = parser.parse_args()
    try:
        if args.command in ("run-stress", "replay-stress"):
            from pathlib import Path
            from . import stress, live
            from .bundle import write_json

            doc = live.read_experiment(args.source)
            if args.command == "run-stress":
                out = Path(args.out)
                if out.exists():
                    raise ValueError("Choose a fresh output file")
                result = stress.evaluate(doc)
                out.parent.mkdir(parents=True, exist_ok=True)
                write_json(out, result)
                print(f"Detector sweep ready: {len(result['rows'])} results in {out}")
            else:
                result = stress.replay(doc)
                print(f"PASS: {len(result['rows'])} detector rows, settings, filters and source")
        elif args.command == "replay-beats":
            from . import beats, live

            beats.replay(live.read_experiment(args.source))
            print(
                "PASS: detection source, settings, scores, candidates, matching and rate estimates"
            )
        elif args.command in ("run-batch", "replay-batch"):
            from pathlib import Path
            from . import batch, live
            from .bundle import write_json

            doc = live.read_experiment(args.source)
            if args.command == "run-batch":
                out = Path(args.out)
                if out.exists():
                    raise ValueError("Choose a fresh output file")
                result = batch.evaluate(doc)
                out.parent.mkdir(parents=True, exist_ok=True)
                write_json(out, result)
                print(f"Batch ready: {len(result['rows'])} lead-setting results in {out}")
            else:
                result = batch.replay(doc)
                print(f"PASS: {len(result['rows'])} batch rows, summaries, coefficients and source")
        elif args.command == "replay-clinical":
            from . import clinical, live

            clinical.replay(live.read_experiment(args.source))
            print("PASS: clinical experiment · pinned source, arrays, coefficients and metrics")
        elif args.command in ("run-live", "replay-live"):
            from pathlib import Path
            from . import live
            from .bundle import write_json

            document = live.read_experiment(args.source)
            if args.command == "run-live":
                out = Path(args.out)
                if out.exists():
                    raise ValueError("Output already exists; choose a fresh file")
                result = live.evaluate(document)
                out.parent.mkdir(parents=True, exist_ok=True)
                write_json(out, result)
                print(f"Custom experiment ready: {out}")
            else:
                live.replay(document, args.mode)
                print(f"PASS: custom experiment · {args.mode} · arrays, coefficients and metrics")
        elif args.command == "build":
            paths = build_collection(args.source, args.out)
            print(f"Built {len(paths)} self-contained cases in {args.out}")
        elif args.command == "export-gallery":
            print(f"Gallery ready: {export_gallery(args.source, args.out) / 'index.html'}")
        else:
            paths = bundle_paths(args.source)
            for path in paths:
                if args.command == "verify":
                    verify_case(path)
                else:
                    replay_case(path, args.mode)
            print(
                f"PASS: {len(paths)} bundles · {args.command}"
                + (
                    f" · {args.mode}"
                    if args.command == "replay"
                    else " · payload hashes and schema"
                )
            )
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0
