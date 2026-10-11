"""adapter.build_brief against a fake Supabase client: cutoff semantics for
forks vs the live world, and no fabricated content on errors or missing data."""
from datetime import datetime, timezone

import pytest

from realityshift_media import adapter
from realityshift_media.adapter import BriefUnavailable, build_brief, sample_brief
from realityshift_media.provenance import simulation_metadata


class _Query:
    def __init__(self, rows, fail=None):
        self._rows, self._fail = list(rows), fail

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._rows = [r for r in self._rows if r.get(col) == val]
        return self

    def or_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def execute(self):
        if self._fail:
            raise self._fail
        return type("Res", (), {"data": self._rows})()


class FakeDB:
    def __init__(self, tables, fail_on=None):
        self.tables, self.fail_on = tables, fail_on or {}

    def table(self, name):
        return _Query(self.tables.get(name, []), self.fail_on.get(name))


STATE = {"indicators": {"gdp_per_capita": 2500.0}, "policies": {}}
TABLES = {
    "country_states": [
        {"world_id": "live", "country_code": "IND", "year": 2027, **STATE},
        {"world_id": "fork-7", "country_code": "IND", "year": 2027,
         "indicators": {"gdp_per_capita": 2700.0}, "policies": {}},
    ],
    "worlds": [{"id": "fork-7", "forked_at_year": 2026, "fork_of": "live",
                "created_at": "2026-08-01T09:30:15.123456+00:00"}],
    "agent_decisions": [{"world_id": "fork-7", "country_code": "IND", "year": 2027,
                         "reasoning": "Raise education spend.", "historical_parallel": None}],
    "world_events": [],
}


def _use(monkeypatch, db):
    monkeypatch.setattr(adapter, "_client", lambda: db)


def test_fork_cutoff_is_worlds_created_at(monkeypatch):
    _use(monkeypatch, FakeDB(TABLES))
    brief = build_brief("IND", 2027, world_id="fork-7")
    assert brief.real_world_data_cutoff == datetime(2026, 8, 1, 9, 30, 15, 123456, tzinfo=timezone.utc)
    assert brief.live_world is False and brief.sample is False
    assert brief.parent_fork_id == "live"
    assert brief.consensus_delta == {"gdp_per_capita": 200.0}
    meta = simulation_metadata(brief)
    assert meta["real_world_data_cutoff"] == "2026-08-01T09:30:15.123Z"
    assert meta["divergence_date"] == "2026-01-01"


def test_live_world_has_null_cutoff(monkeypatch):
    _use(monkeypatch, FakeDB(TABLES))
    brief = build_brief("IND", 2027, world_id="live")
    assert brief.real_world_data_cutoff is None
    assert brief.live_world is True
    meta = simulation_metadata(brief)
    assert meta["real_world_data_cutoff"] is None and meta["live_world"] is True


def test_fork_without_created_at_is_unavailable(monkeypatch):
    tables = {**TABLES, "worlds": [{"id": "fork-7", "forked_at_year": 2026, "fork_of": "live"}]}
    _use(monkeypatch, FakeDB(tables))
    with pytest.raises(BriefUnavailable, match="created_at"):
        build_brief("IND", 2027, world_id="fork-7")


def test_unknown_fork_is_unavailable(monkeypatch):
    tables = {**TABLES, "worlds": []}
    _use(monkeypatch, FakeDB(tables))
    with pytest.raises(BriefUnavailable, match="worlds row"):
        build_brief("IND", 2027, world_id="fork-7")


# ── no fabrication ───────────────────────────────────────────────────────────
def test_missing_state_raises_instead_of_inventing(monkeypatch):
    _use(monkeypatch, FakeDB(TABLES))
    with pytest.raises(BriefUnavailable, match="no country_states row"):
        build_brief("IND", 2031, world_id="live")


def test_supabase_error_raises_instead_of_inventing(monkeypatch):
    _use(monkeypatch, FakeDB(TABLES, fail_on={"country_states": ConnectionError("boom")}))
    with pytest.raises(BriefUnavailable, match="Supabase query failed") as ei:
        build_brief("IND", 2027, world_id="live")
    assert isinstance(ei.value.__cause__, ConnectionError)


def test_error_in_later_query_also_raises(monkeypatch):
    _use(monkeypatch, FakeDB(TABLES, fail_on={"agent_decisions": TimeoutError("slow")}))
    with pytest.raises(BriefUnavailable):
        build_brief("IND", 2027, world_id="fork-7")


def test_unconfigured_supabase_raises(monkeypatch):
    for var in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_ANON_KEY"):
        monkeypatch.delenv(var, raising=False)
    with pytest.raises(BriefUnavailable, match="not configured"):
        build_brief("IND", 2027)


def test_sample_brief_is_explicit_and_marked():
    brief = sample_brief("IND", 2027)
    meta = simulation_metadata(brief)
    assert meta["sample"] is True
    assert meta["fork_id"] == "sample"
    assert meta["live_world"] is False
    assert meta["real_world_data_cutoff"] is None
    assert "Strategic Accord" not in brief.beats[0].headline
