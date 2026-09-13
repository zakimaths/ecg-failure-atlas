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
    args = parser.parse_args()
    try:
        if args.command in ("run-live", "replay-live"):
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
