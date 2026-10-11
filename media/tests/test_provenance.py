"""Provenance is the submission's core idea, so it gets a real test.

These run fully offline — no B2, no GMICloud, no network — by driving the same
Manifest path a real pipeline uses. They prove the simulation fields are inside
the canonical SHA-256, which is what makes `genblaze verify` on a downloaded
asset meaningful.

Cutoff semantics (shared contract): a fork's real_world_data_cutoff is its
worlds.created_at as ISO-8601 UTC; the live world has a null cutoff and
live_world=true. A null cutoff is still bound into the hash.
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from genblaze_core.models.manifest import Manifest
from genblaze_core.models.run import Run
from genblaze_core.models.step import Step

from realityshift_media.contracts import DivergenceBrief, NarrativeBeat, cutoff_iso
from realityshift_media.provenance import simulation_metadata

CREATED_AT = datetime(2026, 8, 1, 9, 30, 15, 123456, tzinfo=timezone.utc)


def _fork(fork_id="fork-1", cutoff=CREATED_AT):
    return DivergenceBrief(
        fork_id=fork_id,
        parent_fork_id="live",
        divergence_date=date(2026, 1, 1),
        sim_date=date(2028, 11, 5),
        nation_iso="IND",
        beats=[NarrativeBeat(headline="h", summary="s", entities=["IND"])],
        real_world_data_cutoff=cutoff,
        consensus_delta={"gdp_per_capita": 812.5},
    )


def _live():
    return DivergenceBrief(
        fork_id="live", divergence_date=date(2026, 1, 1), sim_date=date(2026, 11, 5),
        nation_iso="IND", live_world=True,
        beats=[NarrativeBeat(headline="h", summary="s", entities=["IND"])],
    )


def _hash_for_meta(meta):
    run = Run(name="broadcast", steps=[Step(provider="p", model="m", prompt="x")])
    run.metadata = {"simulation": meta}
    return Manifest.from_run(run).canonical_hash


def _hash_for(brief):
    return _hash_for_meta(simulation_metadata(brief))


# ── fork cutoff ──────────────────────────────────────────────────────────────
def test_fork_cutoff_is_created_at_as_iso_utc():
    meta = simulation_metadata(_fork())
    assert meta["real_world_data_cutoff"] == "2026-08-01T09:30:15.123Z"
    assert meta["live_world"] is False
    assert meta["sample"] is False
    # The cutoff is a real-world instant, not the sim year's Jan 1.
    assert meta["real_world_data_cutoff"] != meta["divergence_date"]


def test_fork_cutoff_normalised_to_utc():
    ist = timezone(timedelta(hours=5, minutes=30))
    same_instant = CREATED_AT.astimezone(ist)
    assert simulation_metadata(_fork(cutoff=same_instant)) == simulation_metadata(_fork())


def test_fork_requires_a_cutoff():
    with pytest.raises(ValueError):
        _fork(cutoff=None)


def test_naive_cutoff_rejected():
    with pytest.raises(ValueError):
        _fork(cutoff=datetime(2026, 8, 1, 9, 30))


def test_plain_date_cutoff_rejected():
    # The old behaviour (Jan 1 of the sim year as a date) must not sneak back in.
    with pytest.raises(ValueError):
        _fork(cutoff=date(2026, 1, 1))


# ── live world ───────────────────────────────────────────────────────────────
def test_live_world_has_null_cutoff_and_flag():
    meta = simulation_metadata(_live())
    assert meta["real_world_data_cutoff"] is None
    assert "real_world_data_cutoff" in meta  # present, not omitted
    assert meta["live_world"] is True
    assert meta["sample"] is False


def test_live_world_rejects_a_cutoff():
    with pytest.raises(ValueError):
        DivergenceBrief(fork_id="live", live_world=True, divergence_date=date(2026, 1, 1),
                        sim_date=date(2026, 11, 5), real_world_data_cutoff=CREATED_AT)


def test_live_flag_must_match_fork_id():
    with pytest.raises(ValueError):
        DivergenceBrief(fork_id="live", divergence_date=date(2026, 1, 1),
                        sim_date=date(2026, 11, 5))  # live_world missing
    with pytest.raises(ValueError):
        DivergenceBrief(fork_id="fork-9", live_world=True, divergence_date=date(2026, 1, 1),
                        sim_date=date(2026, 11, 5))


def test_cutoff_iso_none():
    assert cutoff_iso(None) is None


# ── hash binding ─────────────────────────────────────────────────────────────
def test_simulation_fields_present():
    meta = simulation_metadata(_fork())
    assert meta["fork_id"] == "fork-1"
    assert meta["is_counterfactual"] is True
    assert meta["consensus_reality"] is False


def test_fork_id_is_bound_into_the_canonical_hash():
    assert _hash_for(_fork(fork_id="fork-A")) != _hash_for(_fork(fork_id="fork-B"))


def test_data_cutoff_is_bound_into_the_canonical_hash():
    later = CREATED_AT + timedelta(days=30)
    assert _hash_for(_fork(cutoff=CREATED_AT)) != _hash_for(_fork(cutoff=later))


def test_null_cutoff_is_bound_into_the_canonical_hash():
    meta = simulation_metadata(_live())
    h = _hash_for_meta(meta)
    # Replacing the null with a timestamp changes the hash ...
    assert h != _hash_for_meta({**meta, "real_world_data_cutoff": "2026-08-01T09:30:15.123Z"})
    # ... and so does dropping the key: null is hashed, not ignored.
    stripped = {k: v for k, v in meta.items() if k != "real_world_data_cutoff"}
    assert h != _hash_for_meta(stripped)
    # Flipping the live flag changes it too.
    assert h != _hash_for_meta({**meta, "live_world": False})


def test_live_manifest_verifies_with_null_cutoff():
    run = Run(name="b", steps=[Step(provider="p", model="m", prompt="x")])
    run.metadata = {"simulation": simulation_metadata(_live())}
    manifest = Manifest.from_run(run)
    assert manifest.verify() is True


def test_hash_is_deterministic():
    assert _hash_for(_fork()) == _hash_for(_fork())
    assert _hash_for(_live()) == _hash_for(_live())
