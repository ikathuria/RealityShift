"""Batch runner, fully offline: stub illustrations, no Supabase, no B2.

build_brief is monkeypatched to a fixture so the batch logic (fan-out, graceful
per-item failure, local index write) is tested without network.
"""
import json
import os
from datetime import date, datetime, timezone

from realityshift_media import batch as batch_mod
from realityshift_media.batch import run_batch, year_range
from realityshift_media.contracts import DivergenceBrief, NarrativeBeat

os.environ.setdefault("RS_MEDIA_STUB", "1")

CUTOFF = datetime(2026, 8, 1, 9, 30, tzinfo=timezone.utc)


def test_year_range_fans_out():
    pairs = year_range(["IND", "USA"], 2025, 2027)
    assert len(pairs) == 6
    assert ("IND", 2025) in pairs and ("USA", 2027) in pairs


def _fixture_brief(nation, year, world_id="live"):
    if nation == "ZZZ":
        raise ValueError("no data")  # exercise the graceful-failure path
    return DivergenceBrief(
        fork_id=world_id, divergence_date=date(year, 1, 1), sim_date=date(year, 1, 1),
        nation_iso=nation, live_world=(world_id == "live"),
        real_world_data_cutoff=None if world_id == "live" else CUTOFF,
        beats=[NarrativeBeat(headline="Policy shift", summary="s", entities=[nation])],
    )


def test_run_batch_writes_local_index_and_skips_failures(monkeypatch, tmp_path):
    monkeypatch.setattr(batch_mod, "build_brief", _fixture_brief)
    monkeypatch.delenv("B2_BUCKET", raising=False)  # force local mode

    res = run_batch(
        [("IND", 2027), ("USA", 2027), ("ZZZ", 2027)],
        world_id="live", backend="local", out_dir=str(tmp_path),
    )

    assert res.generated == 2          # IND + USA
    assert len(res.failed) == 1        # ZZZ
    assert "ZZZ" in res.failed[0]

    # index written locally, listing the two successes
    idx = json.loads((tmp_path / "media-index-live.json").read_text())
    assert idx["count"] == 2
    assert {m["nation_iso"] for m in idx["media"]} == {"IND", "USA"}

    # the PNGs exist
    assert (tmp_path / "frontpage-live-IND-2027.png").exists()
    assert (tmp_path / "frontpage-live-USA-2027.png").exists()


def _fork_brief(nation, year, world_id="fork-7"):
    return DivergenceBrief(
        fork_id=world_id, parent_fork_id="live", divergence_date=date(2026, 1, 1),
        sim_date=date(year, 11, 5), nation_iso=nation, real_world_data_cutoff=CUTOFF,
        beats=[NarrativeBeat(headline="Policy shift", summary="s", entities=[nation])],
    )


def test_front_page_index_entries_carry_provenance(monkeypatch, tmp_path):
    from realityshift_media.provenance import simulation_metadata

    monkeypatch.setattr(batch_mod, "build_brief", _fork_brief)
    monkeypatch.delenv("B2_BUCKET", raising=False)

    run_batch([("IND", 2027)], world_id="fork-7", backend="local", out_dir=str(tmp_path))

    idx = json.loads((tmp_path / "media-index-fork-7.json").read_text())
    (entry,) = idx["media"]
    assert entry["kind"] == "front_page"
    assert entry["provenance"] == simulation_metadata(_fork_brief("IND", 2027))
    assert entry["provenance"]["real_world_data_cutoff"] == "2026-08-01T09:30:00.000Z"


def test_live_front_page_provenance_has_null_cutoff(monkeypatch, tmp_path):
    monkeypatch.setattr(batch_mod, "build_brief", _fixture_brief)
    monkeypatch.delenv("B2_BUCKET", raising=False)

    run_batch([("IND", 2027)], world_id="live", backend="local", out_dir=str(tmp_path))

    (entry,) = json.loads((tmp_path / "media-index-live.json").read_text())["media"]
    assert entry["provenance"]["real_world_data_cutoff"] is None
    assert entry["provenance"]["live_world"] is True


def test_batch_merges_into_existing_index(monkeypatch, tmp_path):
    monkeypatch.setattr(batch_mod, "build_brief", _fixture_brief)
    monkeypatch.delenv("B2_BUCKET", raising=False)

    run_batch([("IND", 2026), ("USA", 2026)], world_id="live", backend="local", out_dir=str(tmp_path))
    first = json.loads((tmp_path / "media-index-live.json").read_text())
    old_usa = next(m for m in first["media"] if m["nation_iso"] == "USA")

    # A second run for different/overlapping items must keep earlier media.
    run_batch([("IND", 2026), ("BRA", 2027)], world_id="live", backend="local", out_dir=str(tmp_path))
    idx = json.loads((tmp_path / "media-index-live.json").read_text())

    keys = [(m["sim_date"], m["nation_iso"], m["kind"]) for m in idx["media"]]
    assert keys == sorted(keys)
    assert idx["count"] == 3
    assert {m["nation_iso"] for m in idx["media"]} == {"IND", "USA", "BRA"}
    assert next(m for m in idx["media"] if m["nation_iso"] == "USA") == old_usa


def test_batch_with_only_failures_keeps_existing_index(monkeypatch, tmp_path):
    from realityshift_media.adapter import BriefUnavailable

    monkeypatch.setattr(batch_mod, "build_brief", _fixture_brief)
    monkeypatch.delenv("B2_BUCKET", raising=False)
    run_batch([("IND", 2026)], world_id="live", backend="local", out_dir=str(tmp_path))

    def _unavailable(nation, year, world_id="live"):
        raise BriefUnavailable("no country_states row")

    monkeypatch.setattr(batch_mod, "build_brief", _unavailable)
    res = run_batch([("IND", 2027)], world_id="live", backend="local", out_dir=str(tmp_path))
    assert res.generated == 0
    assert "skipped" in res.failed[0] and "no country_states row" in res.failed[0]
    idx = json.loads((tmp_path / "media-index-live.json").read_text())
    assert [m["nation_iso"] for m in idx["media"]] == ["IND"]


def test_corrupt_existing_index_is_not_overwritten(monkeypatch, tmp_path):
    import pytest

    monkeypatch.setattr(batch_mod, "build_brief", _fixture_brief)
    monkeypatch.delenv("B2_BUCKET", raising=False)
    path = tmp_path / "media-index-live.json"
    path.write_text("{not json")
    with pytest.raises(ValueError):
        run_batch([("IND", 2026)], world_id="live", backend="local", out_dir=str(tmp_path))
    assert path.read_text() == "{not json"


def test_b2_index_is_read_and_merged_before_publish(monkeypatch, tmp_path):
    """Upload path, with the B2 calls stubbed: the existing index is fetched,
    kept entries are re-presigned, and the merged doc is what gets published.
    Briefs are unavailable here, so nothing is generated and the earlier media
    must survive the run."""
    from realityshift_media import presign
    from realityshift_media.adapter import BriefUnavailable
    from realityshift_media.index import MediaEntry, build_index, serialize

    def _unavailable(nation, year, world_id="live"):
        raise BriefUnavailable("no country_states row")

    monkeypatch.setattr(batch_mod, "build_brief", _unavailable)
    monkeypatch.setenv("B2_BUCKET", "rs-media")
    monkeypatch.setenv("B2_KEY_ID", "test")

    old = build_index("live", [MediaEntry(
        "2025-11-05", "USA", "broadcast",
        "https://s3.x/rs-media/broadcasts/live/USA-2025.mp4?X-Amz-Expires=1",
        "(embedded in mp4)", "h0")])
    published = {}
    monkeypatch.setattr(presign, "get_index", lambda key: serialize(old))
    monkeypatch.setattr(presign, "presign_url", lambda url, *a: url + "?fresh=1")
    monkeypatch.setattr(presign, "put_index",
                        lambda key, body: published.update(key=key, body=body) or "https://idx")

    res = run_batch([("IND", 2027)], world_id="live", backend="local", out_dir=str(tmp_path))

    assert res.generated == 0 and res.index_url == "https://idx"
    assert published["key"] == "index/live/media.json"
    doc = json.loads(published["body"])
    assert doc["count"] == 1
    assert doc["media"][0]["b2_url"] == \
        "https://s3.x/rs-media/broadcasts/live/USA-2025.mp4?fresh=1"


def test_get_index_missing_returns_none_and_other_errors_raise(monkeypatch):
    import pytest
    from botocore.exceptions import ClientError
    from realityshift_media import presign

    monkeypatch.setenv("B2_BUCKET", "rs-media")

    class C:
        def __init__(self, code):
            self.code = code

        def get_object(self, **_kw):
            raise ClientError({"Error": {"Code": self.code}}, "GetObject")

    monkeypatch.setattr(presign, "_client", lambda: C("NoSuchKey"))
    assert presign.get_index("index/live/media.json") is None
    monkeypatch.setattr(presign, "_client", lambda: C("AccessDenied"))
    with pytest.raises(ClientError):
        presign.get_index("index/live/media.json")
