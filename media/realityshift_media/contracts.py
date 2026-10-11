"""The stable interface between the simulation and the media layer.

The media layer reads only this shape. Everything the simulation emits is
adapted *into* a DivergenceBrief by adapter.py; nothing downstream of here
touches simulation internals or Supabase directly. Keeping the boundary in one
small module is what lets the media layer stay a pure consumer.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from pydantic import BaseModel, Field, field_validator, model_validator

LIVE_WORLD_ID = "live"


class NarrativeBeat(BaseModel):
    """One story beat of a broadcast — a single reported development."""

    headline: str = Field(..., description="One-line headline for this beat.")
    summary: str = Field(..., description="1-3 sentence factual summary, no illustration of graphic events.")
    entities: list[str] = Field(
        default_factory=list,
        description="Countries/institutions named in the beat, as ISO3 codes or proper names.",
    )
    kind: str = Field(
        default="policy",
        description="policy | diplomacy | conflict | economy — drives b-roll prompt framing.",
    )


class DivergenceBrief(BaseModel):
    """A single fork-year, ready to drive a media pipeline.

    For a fork, divergence is measured against the live world at the same sim
    year, NOT against reality.

    Provenance semantics (shared contract with the frontend and workers):

    - Fork: `real_world_data_cutoff` is the fork's `worlds.created_at`, a
      timezone-aware UTC timestamp. It is the real moment the live state was
      copied, so real-news corrections up to then are included and none after.
    - Live world (`live_world=True`): `real_world_data_cutoff` is None, because
      the live world keeps ingesting real news monthly and has no cutoff.
    - Sample (`sample=True`): an explicit, opt-in synthetic brief for offline
      demos. Never produced by default, never a real world, and marked as such
      in provenance so it can't pass for real media.

    Whatever the case, the cutoff (including a null one) and the flags are
    carried into the provenance block bound into every asset's canonical hash.
    """

    fork_id: str
    parent_fork_id: str | None = None

    # Sim date at which this timeline split from its parent. For a fork this is
    # the start of `forked_at_year`; for the live world, the start of the sim
    # year being reported (it is re-anchored to reality as news arrives).
    divergence_date: date
    # The in-world date this brief reports.
    sim_date: date
    # ISO3 of the nation this brief is about; None for a global segment.
    nation_iso: str | None = None

    beats: list[NarrativeBeat] = Field(default_factory=list)

    # Real-world (UTC) moment after which no real data entered this world.
    # Required for a fork; None for the live world and for samples.
    real_world_data_cutoff: datetime | None = None

    # True only for world_id == "live".
    live_world: bool = False
    # True only for explicit, synthetic offline sample briefs.
    sample: bool = False

    # How this fork's state differs from the live world at sim_date, per
    # indicator. Structured, not prose, so the script step can reason over it.
    consensus_delta: dict[str, float] = Field(default_factory=dict)

    @field_validator("real_world_data_cutoff")
    @classmethod
    def _cutoff_is_utc(cls, v: datetime | None) -> datetime | None:
        if v is None:
            return None
        if v.tzinfo is None or v.utcoffset() is None:
            raise ValueError(
                "real_world_data_cutoff must be timezone-aware (a real UTC moment, "
                "e.g. worlds.created_at), not a naive datetime."
            )
        return v.astimezone(timezone.utc)

    @model_validator(mode="after")
    def _check_world_kind(self) -> "DivergenceBrief":
        if self.live_world and self.sample:
            raise ValueError("a brief cannot be both live_world and sample")
        if self.live_world or self.fork_id == LIVE_WORLD_ID:
            if not (self.live_world and self.fork_id == LIVE_WORLD_ID):
                raise ValueError(
                    f"live_world must be set exactly when fork_id == {LIVE_WORLD_ID!r} "
                    f"(fork_id={self.fork_id!r}, live_world={self.live_world})"
                )
            if self.real_world_data_cutoff is not None:
                raise ValueError(
                    "the live world has no real_world_data_cutoff (it keeps ingesting "
                    "real news); it must be None"
                )
        elif self.sample:
            if self.real_world_data_cutoff is not None:
                raise ValueError("a sample brief has no real_world_data_cutoff")
        elif self.real_world_data_cutoff is None:
            raise ValueError(
                "a fork requires real_world_data_cutoff = the fork's worlds.created_at"
            )
        return self


def cutoff_iso(cutoff: datetime | None) -> str | None:
    """Canonical ISO-8601 UTC form of a cutoff, or None.

    Millisecond precision with a 'Z' suffix (the same shape as JavaScript's
    Date.toISOString()), so the frontend can parse and compare it directly and
    the hashed string is deterministic for a given instant. Truncating to
    milliseconds can only move the cutoff earlier, never later.
    """
    if cutoff is None:
        return None
    utc = cutoff.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"
