"""Command-line interface.

Examples::

    football-predictor run                      # full daily pipeline
    football-predictor run --backtest-days 90   # ... and seed the track record with a backtest
    football-predictor data                     # only download / rebuild the match table
    football-predictor train                    # retrain and print a hold-out evaluation
    football-predictor export                   # rebuild website JSON from the saved ledger
"""

from __future__ import annotations

import argparse
import logging
import sys


def _cmd_run(args: argparse.Namespace) -> None:
    from .pipeline import run

    run(refresh=not args.offline, backtest_days=args.backtest_days)


def _cmd_data(args: argparse.Namespace) -> None:
    from .dataset import build_matches

    df = build_matches(refresh=not args.offline)
    print(df.groupby("competition").size().sort_values(ascending=False).to_string())


def _cmd_train(args: argparse.Namespace) -> None:
    import pandas as pd

    from . import evaluation as ev
    from .dataset import load_matches
    from .features import build_features
    from .model import MatchModel, training_rows
    from .pipeline import train_model

    matches = load_matches()
    frame, _ = build_features(matches)
    rows = training_rows(frame)
    cutoff = rows["date"].max() - pd.Timedelta(days=args.holdout_days)
    train, test = rows[rows["date"] <= cutoff], rows[rows["date"] > cutoff]
    probs = MatchModel().fit(train).predict(test)[["p_home", "p_draw", "p_away"]].to_numpy()
    y = test["target"].astype(int).to_numpy()
    print(f"Hold-out: last {args.holdout_days} days ({len(test)} matches)")
    for name, p in (("model", probs),):
        print(f"  {name:7s}", {k: round(v, 4) for k, v in ev.summarise(p, y).items()})
    mask = test[["mkt_p_home", "mkt_p_draw", "mkt_p_away"]].notna().all(axis=1).to_numpy()
    print(
        "  market ",
        {k: round(v, 4) for k, v in ev.summarise(ev.baseline_market(test)[mask], y[mask]).items()},
    )
    print(
        "  model* ",
        {k: round(v, 4) for k, v in ev.summarise(probs[mask], y[mask]).items()},
        "(* same matches as market)",
    )
    train_model(matches)
    print("Model retrained on all data and saved.")


def _cmd_export(_: argparse.Namespace) -> None:
    from .pipeline import export_only

    export_only()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="football-predictor",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("run", help="update data, retrain, settle results, predict fixtures, export")
    p.add_argument("--offline", action="store_true", help="use cached data only")
    p.add_argument(
        "--backtest-days", type=int, default=0, help="seed the ledger with a walk-forward backtest"
    )
    p.set_defaults(func=_cmd_run)

    p = sub.add_parser("data", help="download sources and rebuild the match table")
    p.add_argument("--offline", action="store_true")
    p.set_defaults(func=_cmd_data)

    p = sub.add_parser("train", help="evaluate on a hold-out period, then retrain on everything")
    p.add_argument("--holdout-days", type=int, default=365)
    p.set_defaults(func=_cmd_train)

    p = sub.add_parser("export", help="rebuild website JSON from the saved ledger")
    p.set_defaults(func=_cmd_export)

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
