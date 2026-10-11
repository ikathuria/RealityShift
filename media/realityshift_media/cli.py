"""rs-media — batch entry point for the media layer.

  rs-media front-page --nation IND --year 2027 [--world live]

Briefs are built from real simulation data in Supabase (SUPABASE_URL + key in
the environment or media/.env). If there is no data for a nation-year, the
command fails with the reason; it never invents a story. `--dry-run` builds the
brief and prints the prompt and the provenance block without generating media.
`--sample` uses an explicit synthetic brief instead (provenance carries
`"sample": true`), for offline demos; sample media is never uploaded to B2.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from dotenv import load_dotenv


def main(argv: list[str] | None = None) -> int:
    load_dotenv()  # media/.env if present
    parser = argparse.ArgumentParser(prog="rs-media")
    sub = parser.add_subparsers(dest="command", required=True)

    fp = sub.add_parser("front-page", help="Generate a newspaper front page.")
    fp.add_argument("--nation", required=True, help="ISO3 country code, e.g. IND")
    fp.add_argument("--year", required=True, type=int, help="Simulated year")
    fp.add_argument("--world", default="live", help="world_id (fork id, or 'live')")
    fp.add_argument("--backend", default="local", choices=["local", "cloud"],
                    help="local diffusion (default, free, on-device) or cloud (GMICloud)")
    fp.add_argument("--out", default=None, help="Directory to save the PNG locally (when not uploading to B2).")
    fp.add_argument("--dry-run", action="store_true", help="Build the brief and prompt only; no generation.")
    fp.add_argument("--sample", action="store_true",
                    help="Use a synthetic sample brief (marked sample in provenance; offline only, never uploaded).")

    bt = sub.add_parser("batch", help="Generate many front pages and publish the index.")
    bt.add_argument("--nations", required=True, help="Comma-separated ISO3 codes, e.g. IND,USA,BRA")
    bt.add_argument("--from-year", required=True, type=int)
    bt.add_argument("--to-year", required=True, type=int)
    bt.add_argument("--world", default="live")
    bt.add_argument("--backend", default="local", choices=["local", "cloud"])
    bt.add_argument("--public", action="store_true", help="Store public URLs instead of presigned (public bucket).")
    bt.add_argument("--broadcast", default="", help="Comma-separated nations to also make a broadcast for (uses --to-year).")
    bt.add_argument("--out", default="out", help="Local output dir when B2 credentials are absent.")

    bc = sub.add_parser("broadcast", help="Generate a divergence broadcast (video).")
    bc.add_argument("--nation", required=True)
    bc.add_argument("--year", required=True, type=int)
    bc.add_argument("--world", default="live")
    bc.add_argument("--out", default="out")
    bc.add_argument("--sample", action="store_true",
                    help="Use a synthetic sample brief (marked sample in provenance; offline only, never uploaded).")

    sub.add_parser("setup-cors", help="Set the B2 bucket CORS rule so the browser can read media.")

    args = parser.parse_args(argv)

    if args.command == "front-page":
        return _front_page(args)
    if args.command == "batch":
        return _batch(args)
    if args.command == "broadcast":
        return _broadcast(args)
    if args.command == "setup-cors":
        from .presign import configure_cors
        configure_cors()
        print(f"CORS configured on {os.environ.get('B2_BUCKET')} (GET/HEAD from any origin).")
        return 0
    return 2


def _batch(args) -> int:
    from .batch import run_batch, year_range

    nations = [n.strip().upper() for n in args.nations.split(",") if n.strip()]
    pairs = year_range(nations, args.from_year, args.to_year)
    # Broadcasts use the latest year (--to-year) for each requested nation.
    bc_nations = [n.strip().upper() for n in args.broadcast.split(",") if n.strip()]
    broadcasts = [(n, args.to_year) for n in bc_nations]
    print(f"generating {len(pairs)} front pages + {len(broadcasts)} broadcast(s) "
          f"via {args.backend}…")

    res = run_batch(
        pairs, world_id=args.world, backend=args.backend,
        private=not args.public, out_dir=args.out, broadcasts=broadcasts,
    )
    print(f"\ngenerated: {res.generated}   failed: {len(res.failed)}")
    for f in res.failed:
        print("  ✗", f, file=sys.stderr)
    print(f"index: {res.index_url}")
    print("set VITE_B2_PUBLIC_BASE so the wall reads this index." if res.index_url and res.index_url.startswith("http")
          else "no B2 creds — wrote images + index locally under the output dir.")
    return 0 if res.generated else 1


def _load_brief(args):
    """Real brief, or an explicit sample. Prints the reason and returns None
    when there is no real data (never falls back to invented content)."""
    from .adapter import BriefUnavailable, build_brief, sample_brief

    if getattr(args, "sample", False):
        print("using a SYNTHETIC sample brief (provenance: sample=true); it will not be uploaded.",
              file=sys.stderr)
        return sample_brief(args.nation, args.year)
    try:
        return build_brief(args.nation, args.year, world_id=args.world)
    except BriefUnavailable as exc:
        print(f"no brief for {args.world}/{args.nation}@{args.year}: {exc}", file=sys.stderr)
        return None


def _broadcast(args) -> int:
    from .broadcast import generate_broadcast

    brief = _load_brief(args)
    if brief is None:
        return 1
    print(f"generating broadcast for {args.nation} @ {args.year} (local; this takes a minute)…")
    res = generate_broadcast(brief, out_dir=args.out)
    print(f"mp4: {res['mp4']}  ({res['duration']}s)")
    print(f"manifest verifies: {res['verified']}  hash: {res['canonical_hash'][:16]}…")

    # Upload to B2 + register in the media index when credentials are present.
    if not brief.sample and os.environ.get("B2_BUCKET") and os.environ.get("B2_KEY_ID"):
        from .presign import put_file
        key = f"broadcasts/{args.world}/{args.nation}-{args.year}.mp4"
        try:
            url = put_file(key, res["mp4"], "video/mp4")
            print(f"uploaded to B2; presigned url:\n  {url[:90]}…")
        except Exception as e:
            print(f"B2 upload skipped: {e}")
        print("add this broadcast to the wall index by re-running `rs-media batch` "
              "(broadcasts and front pages share the index).")
    return 0 if res["verified"] else 1


def _front_page(args) -> int:
    from .prompts import front_page_prompt
    from .provenance import simulation_metadata

    brief = _load_brief(args)
    if brief is None:
        return 1
    prompt = front_page_prompt(brief)

    if args.dry_run:
        print("PROMPT:\n", prompt, "\n")
        print("PROVENANCE (bound into the manifest hash):")
        print(json.dumps(simulation_metadata(brief), indent=2))
        print(f"\nbeats: {len(brief.beats)}")
        return 0

    import shutil
    import urllib.parse

    from .index import entry_from_result
    from .pipelines.front_page import generate_front_page

    # Upload to B2 only when credentials are present; otherwise save locally.
    sink = None
    if not brief.sample and os.environ.get("B2_BUCKET") and os.environ.get("B2_KEY_ID"):
        from .storage import backblaze_sink
        sink = backblaze_sink()

    result = generate_front_page(brief, backend=args.backend, sink=sink)
    if result.failed_steps():
        print("generation failed:", result.error_summary(), file=sys.stderr)
        return 1

    asset = result.run.steps[-1].assets[0]
    if sink is None:
        out_dir = args.out or "."
        os.makedirs(out_dir, exist_ok=True)
        dst = os.path.join(out_dir, f"frontpage-{args.world}-{args.nation}-{args.year}.png")
        shutil.copy(urllib.parse.urlparse(asset.url).path, dst)
        print(f"saved: {dst}")
        print(f"manifest verifies: {result.manifest.verify()}  hash: {result.manifest.canonical_hash[:16]}…")
        return 0

    entry = entry_from_result(
        result, sim_date=brief.sim_date.isoformat(), nation_iso=brief.nation_iso, kind="front_page"
    )
    print(json.dumps(entry.__dict__, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
