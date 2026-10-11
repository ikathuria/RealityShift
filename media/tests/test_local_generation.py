"""Local-generation path, fully offline (stub illustration, no torch, no B2).

Proves the end-to-end front-page pipeline produces a verifiable manifest whose
canonical hash carries the simulation provenance — the same guarantee the cloud
path gives, with no credentials at all.
"""
import os
import urllib.parse
from datetime import date, datetime, timezone

import pytest

from realityshift_media.contracts import DivergenceBrief, NarrativeBeat
from realityshift_media.newspaper import compose_front_page
from realityshift_media.pipelines.front_page import generate_front_page

os.environ.setdefault("RS_MEDIA_STUB", "1")  # never load torch in tests


def _brief():
    return DivergenceBrief(
        fork_id="fork-42", parent_fork_id="live",
        divergence_date=date(2019, 3, 1), sim_date=date(2027, 1, 1),
        nation_iso="IND", real_world_data_cutoff=datetime(2026, 8, 1, 9, 30, tzinfo=timezone.utc),
        beats=[
            NarrativeBeat(headline="Government sets its course", summary="s", entities=["IND"], kind="policy"),
            NarrativeBeat(headline="Echoes of an earlier era", summary="s", entities=["IND"], kind="policy"),
        ],
    )


def test_compose_front_page_returns_png():
    from PIL import Image
    ill = Image.new("RGB", (400, 300), (100, 130, 90))
    png = compose_front_page(ill, masthead="The Test Dispatch", headline="Big news today", dateline="Testland")
    assert png[:8] == b"\x89PNG\r\n\x1a\n"  # PNG signature


def test_local_pipeline_produces_verifiable_manifest():
    result = generate_front_page(_brief(), backend="local", sink=None)
    assert not result.failed_steps()
    assert result.manifest.verify() is True

    # provenance bound into the hash
    sim = result.run.metadata["simulation"]
    assert sim["fork_id"] == "fork-42"
    assert sim["real_world_data_cutoff"] == "2026-08-01T09:30:00.000Z"
    assert sim["live_world"] is False and sim["sample"] is False

    # the headline is carried in step metadata (and thus the hash)
    assert result.run.steps[-1].metadata["newspaper"]["headline"] == "Government sets its course"

    # a real PNG exists on disk
    asset = result.run.steps[-1].assets[0]
    path = urllib.parse.urlparse(asset.url).path
    assert os.path.getsize(path) > 1000
    assert asset.sha256 and len(asset.sha256) == 64


def test_backend_selection_is_validated():
    with pytest.raises(ValueError):
        generate_front_page(_brief(), backend="nonsense", sink=None)
