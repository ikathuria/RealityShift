"""Per-fork media index, written to B2 as JSON.

The frontend reads this to render the front-page wall — it fetches
`index/{world_id}/media.json` and streams every asset straight from B2, with no
Worker or Supabase round-trip. This is deliberately a B2 object, not a Postgres
table: the batch generator is the sole writer (no lost-update risk), the
frontend always wants the whole set, and fork media is as public as the fork.
So the media layer adds no schema change.

Each batch run MERGES into the existing index rather than replacing it: entries
are keyed by (kind, nation_iso, sim_date); a new entry replaces the old one with
the same key and every other existing entry is kept, so earlier media never
silently drops off the wall.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass
class MediaEntry:
    sim_date: str          # ISO date
    nation_iso: str | None
    kind: str              # "front_page" | "broadcast" | ...
    b2_url: str            # durable, credential-free asset URL
    manifest_uri: str      # provenance manifest location in B2
    canonical_hash: str    # ties the asset to its manifest
    duration: float | None = None          # seconds, for broadcasts
    provenance: dict | None = None          # simulation.* block, for the UI panel


def index_key(world_id: str) -> str:
    return f"index/{world_id}/media.json"


def entry_key(row: dict) -> tuple[str, str, str]:
    """Stable identity of an index entry: one asset per kind, nation and sim date."""
    return (row.get("kind") or "", row.get("nation_iso") or "", row.get("sim_date") or "")


def _sort_key(row: dict) -> tuple[str, str, str]:
    return (row.get("sim_date") or "", row.get("nation_iso") or "", row.get("kind") or "")


def merge_entries(existing: list[dict], new: list[MediaEntry]) -> list[dict]:
    """Merge new entries into existing index rows by entry_key.

    Same-key rows are replaced by the new entry; all other existing rows are
    kept. Output is sorted by (sim_date, nation_iso, kind), which is a total
    order because keys are unique after the merge, so the result is
    deterministic regardless of input order.
    """
    merged: dict[tuple[str, str, str], dict] = {}
    for row in existing:
        merged[entry_key(row)] = dict(row)
    for e in new:
        row = asdict(e)
        merged[entry_key(row)] = row
    return sorted(merged.values(), key=_sort_key)


def build_index(world_id: str, entries: list[MediaEntry],
                existing: dict | None = None) -> dict:
    """The index document, merged over `existing` (a previously written index).

    Sorted for stable diffs and predictable UI ordering.
    """
    prior: list[dict] = []
    if existing:
        if existing.get("world_id") not in (None, world_id):
            raise ValueError(
                f"existing index belongs to world {existing.get('world_id')!r}, not {world_id!r}"
            )
        prior = list(existing.get("media") or [])
    rows = merge_entries(prior, entries)
    return {"world_id": world_id, "count": len(rows), "media": rows}


def parse_index(body: bytes | str) -> dict:
    """Parse a stored index. Raises ValueError if it is not a valid index doc,
    so a corrupt index is reported rather than silently overwritten."""
    try:
        doc = json.loads(body)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"existing media index is not valid JSON: {exc}") from exc
    if not isinstance(doc, dict) or not isinstance(doc.get("media", []), list):
        raise ValueError("existing media index has an unexpected shape")
    return doc


def serialize(index: dict) -> bytes:
    return json.dumps(index, indent=2, sort_keys=False).encode("utf-8")


def entry_from_result(result, *, sim_date: str, nation_iso: str | None, kind: str,
                      private: bool = False, provenance: dict | None = None) -> MediaEntry:
    """Pull the durable URL + manifest identity out of a Genblaze PipelineResult.

    With private=True the asset URL is replaced by a time-limited presigned URL,
    so a private B2 bucket can be read by the browser without a public bucket or
    a Worker proxy. Presigned URLs expire (<=7 days), so re-presign when the
    index is regenerated.

    `provenance` defaults to the run's own `simulation` metadata, i.e. exactly
    the block bound into the manifest hash, so the index never disagrees with
    the asset it points at.
    """
    asset = result.run.steps[-1].assets[0]
    url = asset.url
    if private:
        from .presign import presign_url
        url = presign_url(asset.url)
    if provenance is None:
        provenance = run_provenance(result)
    return MediaEntry(
        sim_date=sim_date,
        nation_iso=nation_iso,
        kind=kind,
        b2_url=url,
        manifest_uri=result.manifest.manifest_uri,
        canonical_hash=result.manifest.canonical_hash,
        provenance=provenance,
    )


def run_provenance(result) -> dict | None:
    """The simulation.* block a PipelineResult's run carries (and hashes)."""
    meta = getattr(result.run, "metadata", None) or {}
    sim = meta.get("simulation")
    return dict(sim) if isinstance(sim, dict) else None
