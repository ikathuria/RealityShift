"""Offline broadcast tests — the parts that need no ffmpeg/say/torch/network.

The full assembly (say + ffmpeg + diffusion) is exercised by `rs-media broadcast`
on a machine that has those tools; here we cover the script and chrome logic.
"""
import os
from datetime import date

from realityshift_media.broadcast import write_script, build_chrome, DISCLAIMER
from realityshift_media.contracts import DivergenceBrief, NarrativeBeat

os.environ.setdefault("RS_MEDIA_STUB", "1")


def _brief():
    return DivergenceBrief(
        fork_id="live", divergence_date=date(2027, 1, 1), sim_date=date(2027, 1, 1),
        nation_iso="IND", live_world=True,
        beats=[
            NarrativeBeat(headline="Government sets its course", summary="A new policy mix.", entities=["IND"]),
            NarrativeBeat(headline="Trade talks resume", summary="Negotiations reopen.", entities=["IND"], kind="diplomacy"),
        ],
    )


def test_script_fallback_leads_with_disclaimer(monkeypatch):
    # No GROQ_API_KEY -> deterministic fallback, disclaimer first.
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    segs = write_script(_brief())
    assert segs[0] == DISCLAIMER
    assert any("Government sets its course" in s for s in segs)
    assert len(segs) >= 3  # disclaimer + beats + sign-off


def test_chrome_is_transparent_and_full_frame():
    layer = build_chrome(masthead_txt="The India Dispatch", chyron="Government sets its course",
                         kind="policy", fork_id="live", sim_date="2027-01-01")
    assert layer.size == (1280, 720)
    assert layer.mode == "RGBA"
    # top-centre is transparent (b-roll shows through); bottom scrim is opaque
    assert layer.getpixel((640, 200))[3] == 0
    assert layer.getpixel((640, 700))[3] > 150


# ── TTS backend selection ────────────────────────────────────────────────────
import pytest

from realityshift_media import broadcast as bc


def _which(available):
    return lambda name: f"/usr/bin/{name}" if name in available else None


def test_tts_prefers_say_when_present(monkeypatch):
    monkeypatch.delenv("RS_TTS_BACKEND", raising=False)
    monkeypatch.setattr(bc.shutil, "which", _which({"say", "espeak-ng"}))
    assert bc.tts_backend() == "say"


def test_tts_falls_back_to_espeak_ng_then_espeak(monkeypatch):
    monkeypatch.delenv("RS_TTS_BACKEND", raising=False)
    monkeypatch.setattr(bc.shutil, "which", _which({"espeak-ng", "espeak"}))
    assert bc.tts_backend() == "espeak-ng"
    monkeypatch.setattr(bc.shutil, "which", _which({"espeak"}))
    assert bc.tts_backend() == "espeak"


def test_tts_missing_raises_with_install_hint(monkeypatch):
    monkeypatch.delenv("RS_TTS_BACKEND", raising=False)
    monkeypatch.setattr(bc.shutil, "which", _which(set()))
    with pytest.raises(bc.TTSUnavailable, match="espeak-ng"):
        bc.tts_backend()


def test_tts_backend_override(monkeypatch):
    monkeypatch.setattr(bc.shutil, "which", _which({"say", "espeak"}))
    monkeypatch.setenv("RS_TTS_BACKEND", "espeak")
    assert bc.tts_backend() == "espeak"
    monkeypatch.setenv("RS_TTS_BACKEND", "festival")
    with pytest.raises(bc.TTSUnavailable):
        bc.tts_backend()


def test_say_command_unchanged_and_espeak_uses_stdin():
    argv, stdin = bc._tts_command("say", "Hello", "/tmp/x.aiff")
    assert argv == ["say", "-v", bc.VOICE, "-o", "/tmp/x.aiff", "Hello"] and stdin is None
    argv, stdin = bc._tts_command("espeak-ng", "-rf /", "/tmp/x.wav")
    assert argv[0] == "espeak-ng" and "--stdin" in argv and "-w" in argv
    assert "-rf /" not in argv and stdin == "-rf /"


def test_tts_runs_engine_then_ffmpeg(monkeypatch, tmp_path):
    calls = []

    def fake_run(argv, **kw):
        calls.append((argv, kw.get("input")))
        if argv[0] == "espeak-ng":
            open(argv[argv.index("-w") + 1], "wb").close()

    monkeypatch.setattr(bc.subprocess, "run", fake_run)
    monkeypatch.setattr(bc, "_duration", lambda _p: 2.5)
    out = str(tmp_path / "vo.wav")
    assert bc.tts("Hello world", out, backend="espeak-ng") == 2.5
    assert calls[0][0][0] == "espeak-ng" and calls[0][1] == "Hello world"
    assert calls[1][0][0] == "ffmpeg" and calls[1][0][-1] == out
    assert not (tmp_path / "vo.wav.raw.wav").exists()  # intermediate cleaned up
