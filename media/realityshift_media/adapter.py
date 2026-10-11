"""Read-only Supabase -> DivergenceBrief.

This is the only module that touches the simulation's data, and it only reads.
It never writes, and it never imports simulation code — the simulation is
TypeScript on Cloudflare Workers, so the boundary is a database, not a function
call.

Fork divergence is derived here, not read from a table: `divergences` has no
world_id and tracks the live world against reality only. For a fork the
meaningful comparison is fork-vs-live at the same sim year, computed by joining
the fork's country_states against world_id='live'.
"""
from __future__ import annotations

import os
from datetime import date, datetime

from supabase import Client, create_client

from .contracts import LIVE_WORLD_ID, DivergenceBrief, NarrativeBeat
from .countries import country_name


class BriefUnavailable(RuntimeError):
    """No brief can be built from real simulation data for this nation-year.

    Raised instead of inventing a story: Supabase unreachable or misconfigured,
    a query error, no country_states row, or a fork without a worlds row.
    Callers skip the item and log the reason.
    """

# Indicators worth reporting a divergence on, and how to phrase a rise/fall.
_INDICATOR_LABELS = {
    "gdp_per_capita": "GDP per capita",
    "military_spend": "military spending",
    "tax_rate": "tax revenue",
    "unemployment": "unemployment",
    "education_spend": "education spending",
    "healthcare_spend": "healthcare spending",
}


def _client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise BriefUnavailable(
            "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_KEY "
            "(or SUPABASE_ANON_KEY) in the environment or media/.env"
        )
    return create_client(url, key)


def _latest_state(db: Client, world_id: str, nation: str, sim_year: int) -> dict | None:
    res = (
        db.table("country_states")
        .select("indicators, policies, year")
        .eq("world_id", world_id)
        .eq("country_code", nation)
        .eq("year", sim_year)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def _consensus_delta(fork: dict, live: dict | None) -> dict[str, float]:
    """Per-indicator (fork - live) at the same sim year. Empty for the live world."""
    if not live:
        return {}
    fi, li = fork.get("indicators") or {}, live.get("indicators") or {}
    delta: dict[str, float] = {}
    for key in _INDICATOR_LABELS:
        if isinstance(fi.get(key), (int, float)) and isinstance(li.get(key), (int, float)):
            diff = float(fi[key]) - float(li[key])
            if abs(diff) > 1e-9:
                delta[key] = round(diff, 4)
    return delta


def _beats(db: Client, world_id: str, nation: str, sim_year: int,
           delta: dict[str, float]) -> list[NarrativeBeat]:
    """Structural beats from the simulation record.

    Deliberately deterministic — built from agent_decisions and world_events, no
    LLM. The broadcast's script step (M14) is where chat() turns these into
    anchor copy; keeping the adapter LLM-free keeps the boundary cheap and
    testable.
    """
    beats: list[NarrativeBeat] = []

    dec = (
        db.table("agent_decisions")
        .select("reasoning, historical_parallel, year")
        .eq("world_id", world_id)
        .eq("country_code", nation)
        .order("year", desc=True)
        .limit(1)
        .execute()
    ).data or []
    if dec and dec[0].get("reasoning"):
        parallel = dec[0].get("historical_parallel") or {}
        pname = parallel.get("name") if isinstance(parallel, dict) else None
        beats.append(NarrativeBeat(
            headline="Government sets its course",
            summary=dec[0]["reasoning"][:400],
            entities=[nation],
            kind="policy",
        ))
        if pname:
            beats.append(NarrativeBeat(
                headline=f"Echoes of {pname}",
                summary=f"Analysts note the policy mix resembles {pname}.",
                entities=[nation],
                kind="policy",
            ))

    events = (
        db.table("world_events")
        .select("event_type, from_country, to_country, details, sim_year")
        .eq("world_id", world_id)
        .or_(f"from_country.eq.{nation},to_country.eq.{nation}")
        .order("sim_year", desc=True)
        .limit(3)
        .execute()
    ).data or []
    for ev in events:
        kind = "conflict" if ev["event_type"] in ("conflict_risk", "military_posture", "sanction") else "diplomacy"
        beats.append(NarrativeBeat(
            headline=ev["event_type"].replace("_", " ").title(),
            summary=ev["details"][:400],
            entities=[c for c in (ev.get("from_country"), ev.get("to_country")) if c],
            kind=kind,
        ))

    for key, diff in delta.items():
        direction = "rises" if diff > 0 else "falls"
        beats.append(NarrativeBeat(
            headline=f"{_INDICATOR_LABELS[key].title()} {direction}",
            summary=f"{_INDICATOR_LABELS[key].capitalize()} {direction} versus the consensus timeline.",
            entities=[nation],
            kind="economy",
        ))

    return beats


def _parse_created_at(value: object, world_id: str) -> datetime:
    """worlds.created_at (timestamptz) -> aware datetime. Raises if unusable."""
    if not isinstance(value, str) or not value:
        raise BriefUnavailable(f"world {world_id!r} has no created_at; cannot state a data cutoff")
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise BriefUnavailable(f"world {world_id!r} has a malformed created_at {value!r}") from exc
    if dt.tzinfo is None:
        raise BriefUnavailable(f"world {world_id!r} created_at {value!r} has no timezone")
    return dt


def build_brief(nation_iso: str, sim_year: int, world_id: str = LIVE_WORLD_ID) -> DivergenceBrief:
    """Assemble a DivergenceBrief for one nation-year from real simulation data.

    Raises BriefUnavailable when there is no real data to report on (Supabase
    not configured or erroring, no country_states row for the year, unknown
    fork). It never invents a story; use sample_brief() for an explicit,
    synthetic offline demo.
    """
    try:
        db = _client()
        fork_state = _latest_state(db, world_id, nation_iso, sim_year)
    except BriefUnavailable:
        raise
    except Exception as exc:  # network / PostgREST errors: report, never fabricate
        raise BriefUnavailable(
            f"Supabase query failed for {world_id}/{nation_iso}@{sim_year}: "
            f"{type(exc).__name__}: {exc}"
        ) from exc

    if not fork_state:
        raise BriefUnavailable(
            f"no country_states row for {world_id}/{nation_iso}@{sim_year}"
        )

    sim_dt = date(sim_year, 11, 5)
    is_live = world_id == LIVE_WORLD_ID

    try:
        if is_live:
            live_state = None
            parent = None
            divergence_dt = date(sim_year, 1, 1)
            cutoff = None  # the live world keeps ingesting real news: no cutoff
        else:
            live_state = _latest_state(db, LIVE_WORLD_ID, nation_iso, sim_year)
            world = (
                db.table("worlds").select("forked_at_year, fork_of, created_at")
                .eq("id", world_id).limit(1).execute()
            ).data or []
            if not world:
                raise BriefUnavailable(f"no worlds row for fork {world_id!r}")
            row = world[0]
            divergence_dt = date(int(row.get("forked_at_year") or sim_year), 1, 1)
            parent = row.get("fork_of")
            # The real moment the live state was copied into this fork.
            cutoff = _parse_created_at(row.get("created_at"), world_id)

        delta = _consensus_delta(fork_state, live_state)
        bts = _beats(db, world_id, nation_iso, sim_year, delta)
    except BriefUnavailable:
        raise
    except Exception as exc:
        raise BriefUnavailable(
            f"Supabase query failed for {world_id}/{nation_iso}@{sim_year}: "
            f"{type(exc).__name__}: {exc}"
        ) from exc

    return DivergenceBrief(
        fork_id=world_id,
        parent_fork_id=parent,
        divergence_date=divergence_dt,
        sim_date=sim_dt,
        nation_iso=nation_iso,
        beats=bts,
        real_world_data_cutoff=cutoff,
        live_world=is_live,
        consensus_delta=delta,
    )


SAMPLE_WORLD_ID = "sample"


def sample_brief(nation_iso: str, sim_year: int) -> DivergenceBrief:
    """An explicit, synthetic brief for offline demos. Opt-in only.

    Not drawn from any world: fork_id is "sample" and provenance carries
    `"sample": true` with a null cutoff, so the output can never pass for real
    live-world or fork media. Never returned by build_brief().
    """
    name = country_name(nation_iso)
    return DivergenceBrief(
        fork_id=SAMPLE_WORLD_ID,
        parent_fork_id=None,
        divergence_date=date(sim_year, 1, 1),
        sim_date=date(sim_year, 11, 5),
        nation_iso=nation_iso,
        beats=[NarrativeBeat(
            headline=f"SAMPLE: {name} (synthetic demo)",
            summary=(f"Synthetic sample content for {name}, not drawn from any "
                     "simulated world. For offline demos only."),
            entities=[nation_iso],
            kind="policy",
        )],
        real_world_data_cutoff=None,
        sample=True,
    )
