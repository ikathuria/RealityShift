"""Offline tests for the front-page path — everything below the network boundary.

No GMICloud, no B2. Covers prompt construction, the synthetic-media constraints,
the watermark, and the index shape.
"""
import io
from datetime import date, datetime, timezone

from PIL import Image

from realityshift_media.contracts import DivergenceBrief, NarrativeBeat
from realityshift_media.prompts import front_page_prompt, masthead
from realityshift_media.watermark import apply_watermark
from realityshift_media.index import MediaEntry, build_index, index_key, merge_entries


def _brief(nation="IND"):
    return DivergenceBrief(
        fork_id="fork-1", parent_fork_id="live",
        divergence_date=date(2019, 3, 1), sim_date=date(2024, 6, 1),
        nation_iso=nation, real_world_data_cutoff=datetime(2026, 8, 1, 9, 30, tzinfo=timezone.utc),
        beats=[
            NarrativeBeat(headline="Government sets its course", summary="s", entities=[nation], kind="policy"),
            NarrativeBeat(headline="Trade talks resume", summary="s", entities=[nation], kind="diplomacy"),
        ],
    )


def test_masthead_is_fictional_and_stable():
    m = masthead("IND")
    assert m.startswith("The ") and "India" in m
    assert masthead("IND") == m  # deterministic


def test_prompt_enforces_no_real_people_and_no_photos():
    p = front_page_prompt(_brief())
    low = p.lower()
    assert "no real people" in low or "no recognisable faces" in low
    assert "no photographs" in low
    assert "illustrat" in low  # illustrated / illustration
    assert "Government sets its course" in p


def test_prompt_has_no_leftover_format_tokens():
    # Guards the sub-headline interpolation, which previously used a fragile
    # nested f-string.
    p = front_page_prompt(_brief())
    assert "{" not in p and "}" not in p
    assert "Trade talks resume" in p


def test_watermark_marks_the_image_and_keeps_dimensions():
    src = Image.new("RGB", (400, 533), (120, 140, 90))
    buf = io.BytesIO(); src.save(buf, format="PNG")
    out = apply_watermark(buf.getvalue())
    result = Image.open(io.BytesIO(out))
    assert result.size == (400, 533)
    # The bottom band must differ from the original flat fill.
    assert result.getpixel((200, 528)) != (120, 140, 90)


def test_index_is_sorted_and_keyed_per_world():
    entries = [
        MediaEntry("2024-06-01", "USA", "front_page", "u2", "m2", "h2"),
        MediaEntry("2024-01-01", "IND", "front_page", "u1", "m1", "h1"),
    ]
    idx = build_index("fork-1", entries)
    assert idx["count"] == 2
    assert idx["media"][0]["sim_date"] == "2024-01-01"  # sorted
    assert index_key("fork-1") == "index/fork-1/media.json"


def test_presign_key_parsing_both_url_styles(monkeypatch):
    # Offline: only the key extraction, no boto3 / network.
    monkeypatch.setenv("B2_BUCKET", "rs-media")
    from realityshift_media.presign import object_key_from_url
    # path-style: https://s3.../bucket/key
    assert object_key_from_url("https://s3.us-west-004.backblazeb2.com/rs-media/assets/ab/cd/abcd.png") == "assets/ab/cd/abcd.png"
    # virtual-hosted: https://bucket.s3.../key
    assert object_key_from_url("https://rs-media.s3.us-west-004.backblazeb2.com/assets/ab/cd/abcd.png") == "assets/ab/cd/abcd.png"


def test_merge_replaces_same_key_and_keeps_others():
    existing = build_index("fork-1", [
        MediaEntry("2024-01-01", "IND", "front_page", "old-ind", "m1", "h1"),
        MediaEntry("2024-01-01", "IND", "broadcast", "bc-ind", "m2", "h2"),
        MediaEntry("2023-01-01", "USA", "front_page", "old-usa", "m3", "h3"),
    ])
    idx = build_index("fork-1", [
        MediaEntry("2024-01-01", "IND", "front_page", "new-ind", "m4", "h4", provenance={"x": 1}),
        MediaEntry("2025-01-01", "BRA", "front_page", "new-bra", "m5", "h5"),
    ], existing=existing)
    urls = [m["b2_url"] for m in idx["media"]]
    assert urls == ["old-usa", "bc-ind", "new-ind", "new-bra"]  # (sim_date, nation, kind)
    assert idx["count"] == 4
    assert idx["media"][2]["provenance"] == {"x": 1}


def test_merge_is_order_independent():
    a = MediaEntry("2024-01-01", "IND", "front_page", "a", "m", "h")
    b = MediaEntry("2024-01-01", "USA", "front_page", "b", "m", "h")
    assert merge_entries([], [a, b]) == merge_entries([], [b, a])


def test_merge_rejects_other_worlds_index():
    import pytest
    with pytest.raises(ValueError):
        build_index("fork-1", [], existing={"world_id": "fork-2", "media": []})
