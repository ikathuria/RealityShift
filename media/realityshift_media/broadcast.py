"""Divergence Broadcast — a ~45-75s AI news segment from a DivergenceBrief.

Entirely local and free, same posture as the front page:
  - script:  Groq Llama 3.3 70B (free, OpenAI-compatible) writes the anchor VO
  - voice:   on-device TTS — macOS `say`, else espeak-ng / espeak (Linux,
             Windows); a spoken synthetic disclaimer leads
  - b-roll:  SDXL-Turbo stills, one per beat (on-device diffusion)
  - motion:  ffmpeg Ken Burns (zoompan) on each still, timed to its narration
  - layout:  every text element (chyron, watermark, fork/date bug, and the
             burned-in spoken-line subtitle) is baked into the frame with Pillow
             — this ffmpeg has no drawtext, and baked text is exact and legible
  - mux:     ffmpeg concats the beat clips and lays the voiceover under them

Genblaze provenance is embedded into the MP4 (Mp4Handler), so `genblaze verify`
on the downloaded file re-derives the hash and shows the simulation.* fields.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

from .contracts import DivergenceBrief
from .prompts import illustration_prompt, masthead
from .countries import country_name

W, H, FPS = 1280, 720, 30
DISCLAIMER = "This is an AI-generated broadcast from a simulated world. No real footage or voices."
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
VOICE = os.environ.get("RS_TTS_VOICE") or "Rishi"           # macOS `say` voice
ESPEAK_VOICE = os.environ.get("RS_ESPEAK_VOICE") or "en-gb" # espeak-ng / espeak voice

# Preference order. `say` first keeps macOS behaviour unchanged.
TTS_BACKENDS = ("say", "espeak-ng", "espeak")


class TTSUnavailable(RuntimeError):
    """No supported text-to-speech engine is installed."""


# ── script ────────────────────────────────────────────────────────────────────
def write_script(brief: DivergenceBrief) -> list[str]:
    """Anchor VO segments: a disclaimer, one line per beat, an outro.

    Falls back to a deterministic script if Groq is unavailable, so the pipeline
    never hard-depends on the network for a demo.
    """
    beats = brief.beats or []
    fallback = [DISCLAIMER] + [f"{b.headline}. {b.summary}" for b in beats][:5] + [
        f"This has been {masthead(brief.nation_iso)}, sim year {brief.sim_date.year}."
    ]

    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return fallback

    beat_lines = "\n".join(f"- {b.headline}: {b.summary}" for b in beats)
    prompt = (
        f"You are scripting a short TV news segment for {country_name(brief.nation_iso)} "
        f"in simulated year {brief.sim_date.year}, in an alternate timeline. Write anchor "
        f"voiceover as a JSON array of strings: the FIRST string must be exactly this "
        f"disclaimer: \"{DISCLAIMER}\". Then one crisp 1-2 sentence narration per beat "
        f"below, in order. End with a one-line sign-off. Neutral broadcast tone, no "
        f"graphic detail. Beats:\n{beat_lines}\n\nReturn ONLY the JSON array."
    )
    body = json.dumps({
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 700,
    }).encode()
    req = urllib.request.Request(GROQ_URL, data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
    })
    try:
        import ssl
        ctx = ssl.create_default_context()
        try:
            import certifi
            ctx.load_verify_locations(certifi.where())
        except Exception:
            pass
        with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
            data = json.loads(r.read())
        text = data["choices"][0]["message"]["content"].strip()
        text = text[text.index("["): text.rindex("]") + 1]
        segs = [s.strip() for s in json.loads(text) if isinstance(s, str) and s.strip()]
        if segs and DISCLAIMER not in segs[0]:
            segs.insert(0, DISCLAIMER)
        return segs or fallback
    except Exception:
        return fallback


# ── voice ───────────────────────────────────────────────────────────────────--
def tts_backend() -> str:
    """Pick the TTS engine: RS_TTS_BACKEND if set, else the first of
    `say`, `espeak-ng`, `espeak` found on PATH.

    Raises TTSUnavailable with install instructions when none is available.
    The broadcast has no silent mode: the spoken synthetic-content disclaimer
    and the narration timing both depend on the voiceover.
    """
    forced = os.environ.get("RS_TTS_BACKEND", "").strip()
    if forced:
        if forced not in TTS_BACKENDS:
            raise TTSUnavailable(
                f"RS_TTS_BACKEND={forced!r} is not supported; use one of {', '.join(TTS_BACKENDS)}"
            )
        if not shutil.which(forced):
            raise TTSUnavailable(f"RS_TTS_BACKEND={forced!r} but `{forced}` is not on PATH")
        return forced
    for name in TTS_BACKENDS:
        if shutil.which(name):
            return name
    raise TTSUnavailable(
        "No text-to-speech engine found for the broadcast voiceover. macOS ships "
        "`say`; on Linux install espeak-ng (e.g. `apt install espeak-ng`, "
        "`dnf install espeak-ng`, `pacman -S espeak-ng`); on Windows install "
        "espeak-ng from https://github.com/espeak-ng/espeak-ng/releases and put it on PATH."
    )


def _tts_command(backend: str, text: str, raw_out: str) -> tuple[list[str], str | None]:
    """(argv, stdin) that synthesises `text` to `raw_out` with `backend`."""
    if backend == "say":
        return ["say", "-v", VOICE, "-o", raw_out, text], None
    # espeak-ng / espeak: text on stdin so it can never be parsed as an option.
    return [backend, "-v", ESPEAK_VOICE, "-w", raw_out, "--stdin"], text


def tts(text: str, out_wav: str, backend: str | None = None) -> float:
    """Speak `text` to a 44.1 kHz stereo wav; return its duration in seconds."""
    backend = backend or tts_backend()
    raw = out_wav + (".aiff" if backend == "say" else ".raw.wav")
    argv, stdin = _tts_command(backend, text, raw)
    subprocess.run(argv, input=stdin, text=stdin is not None, check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-i", raw, "-ar", "44100", "-ac", "2", out_wav], check=True)
    os.remove(raw)
    return _duration(out_wav)


def _duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, check=True).stdout.strip()
    try:
        return max(1.5, float(out))
    except ValueError:
        return 3.0


# ── frames: two layers ────────────────────────────────────────────────────────
# The b-roll is the only thing Ken Burns zooms; the chrome (chyron, watermark,
# bugs) is overlaid STATICALLY on top, so text stays put and — importantly — the
# synthetic-content watermark never drifts off-frame as the zoom crops the edges.

def build_broll(illustration) -> "object":
    """Full-frame darkened b-roll — the layer that zooms."""
    from PIL import Image
    bg = illustration.convert("RGB").resize((W, H), Image.LANCZOS)
    return Image.blend(bg, Image.new("RGB", (W, H), (0, 0, 0)), 0.30)


def build_chrome(*, masthead_txt: str, chyron: str, kind: str,
                 fork_id: str, sim_date: str, caption: str = "") -> "object":
    """Transparent 1280x720 overlay: scrim + lower-third + bugs + watermark.

    `caption` (the spoken narration for this beat) is burned in as a centred
    subtitle band floating just above the lower-third. Baked into the frame for
    the same reason as the chyron: this ffmpeg has no drawtext, browsers won't
    render in-container MP4 text tracks, and hard-subs travel with the file so
    the captions survive the download-and-verify round-trip.
    """
    from PIL import Image, ImageDraw
    from .newspaper import _font

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Subtitle: drawn first, under the lower-third, so the scrim below always
    # wins if a very long caption reaches down into it. Skipped when it would
    # just duplicate the chyron (e.g. the disclaimer intro).
    if caption and caption.strip() and caption.strip() != chyron.strip():
        _caption(d, caption.strip(), _font(27, bold=True), y_bottom=H - 212, max_w=W - 240)

    d.rectangle([0, H - 200, W, H], fill=(8, 10, 18, 205))          # bottom scrim

    d.rectangle([28, 26, 92, 58], fill=(214, 48, 48, 255))          # LIVE
    d.text((38, 31), "LIVE", font=_font(20, bold=True), fill=(255, 255, 255, 255))
    d.text((104, 30), masthead_txt, font=_font(22, bold=True, serif=True), fill=(255, 255, 255, 235))

    wm = "AI-GENERATED · RealityShift"                              # watermark
    wf = _font(17, bold=True)
    ww = d.textbbox((0, 0), wm, font=wf)[2]
    d.rectangle([W - ww - 36, 26, W - 16, 56], fill=(12, 12, 18, 205))
    d.text((W - ww - 26, 32), wm, font=wf, fill=(255, 255, 255, 235))

    badge = kind.upper()                                           # kind badge
    bf = _font(18, bold=True)
    bw = d.textbbox((0, 0), badge, font=bf)[2]
    d.rectangle([40, H - 168, 40 + bw + 24, H - 134], fill=(99, 102, 241, 235))
    d.text((52, H - 163), badge, font=bf, fill=(255, 255, 255, 255))

    _wrap(d, chyron, _font(38, bold=True, serif=True), 40, H - 122, W - 80, (255, 255, 255, 255))
    d.text((40, H - 40), f"fork {fork_id[:12]} · sim {sim_date}",
           font=_font(16), fill=(190, 196, 210, 235))
    return layer


def _wrap(d, text, font, x, y, max_w, fill, leading=4):
    words, line = text.split(), ""
    lh = d.textbbox((0, 0), "Ag", font=font)[3] + leading
    for w in words:
        trial = f"{line} {w}".strip()
        if d.textbbox((0, 0), trial, font=font)[2] <= max_w:
            line = trial
        else:
            d.text((x, y), line, font=font, fill=fill); y += lh; line = w
    if line:
        d.text((x, y), line, font=font, fill=fill)


def _caption(d, text, font, *, y_bottom, max_w, leading=9, pad=14):
    """Centre-wrapped subtitle band whose bottom edge sits at `y_bottom`.

    Grows upward from y_bottom, so it always clears the lower-third below it.
    Each line is drawn centred (anchor="ma") over a translucent box, TV-caption
    style. `max_w` bounds the wrap width; nothing else is clamped because the
    narration is 1-2 sentences by construction.
    """
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = f"{line} {w}".strip()
        if d.textbbox((0, 0), trial, font=font)[2] <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    if not lines:
        return

    lh = d.textbbox((0, 0), "Ag", font=font)[3] + leading
    block_h = lh * len(lines)
    widest = max(d.textbbox((0, 0), ln, font=font)[2] for ln in lines)
    cx = W // 2
    box_w = widest + pad * 4
    box_top = y_bottom - block_h - pad
    d.rectangle([cx - box_w // 2, box_top, cx + box_w // 2, y_bottom + pad],
                fill=(8, 10, 18, 200))
    y = box_top + pad
    for ln in lines:
        d.text((cx, y), ln, font=font, fill=(255, 255, 255, 255), anchor="ma")
        y += lh


# ── ffmpeg assembly ───────────────────────────────────────────────────────────
def _beat_clip(broll_png: str, chrome_png: str, wav: str, dur: float, out_mp4: str) -> None:
    """Ken Burns the b-roll for `dur`s, overlay the static chrome, mux the VO.

    Only the b-roll zooms; the chrome (with the watermark) is a fixed overlay, so
    it never drifts off-frame. Per-clip audio + shared encode settings keep the
    final concat a lossless copy with no A/V drift.
    """
    frames = max(1, int(dur * FPS))
    fc = (f"[0:v]scale={W*2}:{H*2},"
          f"zoompan=z='min(zoom+0.0009,1.15)':d={frames}:s={W}x{H}:fps={FPS}[bg];"
          f"[bg][1:v]overlay=0:0,format=yuv420p[v]")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-loop", "1", "-i", broll_png, "-loop", "1", "-i", chrome_png,
                    "-i", wav, "-t", f"{dur:.2f}", "-filter_complex", fc,
                    "-map", "[v]", "-map", "2:a", "-r", str(FPS),
                    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
                    "-shortest", out_mp4], check=True)


def _concat(paths: list[str], out: str, workdir: str) -> None:
    listfile = os.path.join(workdir, "concat.txt")
    with open(listfile, "w") as fh:
        for p in paths:
            fh.write(f"file '{p}'\n")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "concat", "-safe", "0", "-i", listfile,
                    "-c", "copy", "-movflags", "+faststart", out], check=True)


def assemble_broadcast(brief: DivergenceBrief, illustrator, *, out_mp4: str) -> float:
    """Build the full segment to out_mp4. `illustrator(prompt, seed)->PIL.Image`.

    Returns total duration (s). One beat per narration segment (after the
    disclaimer intro), each shown for exactly its spoken length so audio and
    video stay in lock-step.
    """
    voice = tts_backend()  # fail fast, before any diffusion work
    segments = write_script(brief)
    beats = brief.beats or []
    paper = masthead(brief.nation_iso)
    fork, simd = brief.fork_id, brief.sim_date.isoformat()

    work = tempfile.mkdtemp(prefix="rs-broadcast-")
    clips, total = [], 0.0

    for i, seg in enumerate(segments):
        wav = os.path.join(work, f"vo{i}.wav")
        dur = tts(seg, wav, backend=voice)

        # segment 0 is the disclaimer intro (lead art); segments 1..N map to beats.
        beat = beats[i - 1] if 0 < i <= len(beats) else (beats[0] if beats else None)
        is_intro = (i == 0)
        prompt = illustration_prompt(brief) if (is_intro or beat is None) else (
            f"Editorial illustration, flat risograph poster style, muted two-tone, "
            f"depicting {beat.summary[:160]}. No text, no real people, no faces."
        )
        seed = (abs(hash((brief.fork_id, i))) % 2_000_000)
        try:
            ill = illustrator(prompt, seed=seed)
        except Exception:
            ill = Image.new("RGB", (W, H), (12, 16, 28))

        chyron = DISCLAIMER if is_intro else (beat.headline if beat else paper)
        kind = "disclaimer" if is_intro else (beat.kind if beat else "recap")

        broll_fp = os.path.join(work, f"broll{i}.png")
        chrome_fp = os.path.join(work, f"chrome{i}.png")
        build_broll(ill).save(broll_fp)
        build_chrome(masthead_txt=paper, chyron=chyron, kind=kind,
                     fork_id=fork, sim_date=simd, caption=seg).save(chrome_fp)

        clip = os.path.join(work, f"clip{i}.mp4")
        _beat_clip(broll_fp, chrome_fp, wav, dur, clip)
        clips.append(clip)
        total += dur

    _concat(clips, out_mp4, work)        # lossless copy; A/V already in each clip
    return total


# ── provenance + orchestration ────────────────────────────────────────────────
def generate_broadcast(brief: DivergenceBrief, *, out_dir: str = "out",
                       illustrator=None) -> dict:
    """Produce a broadcast MP4 with an embedded, verifying Genblaze manifest.

    Returns {mp4, manifest, canonical_hash, duration, verified}. The manifest's
    canonical hash carries the simulation.* provenance; Mp4Handler embeds it into
    the file so `genblaze verify` on the download re-derives it.
    """
    import hashlib
    import urllib.parse

    from genblaze_core import Modality
    from genblaze_core.media import Mp4Handler
    from genblaze_core.models.asset import Asset
    from genblaze_core.models.manifest import Manifest
    from genblaze_core.models.run import Run
    from genblaze_core.models.step import Step

    from .prompts import newspaper_fields
    from .provenance import simulation_metadata

    if illustrator is None:
        from .providers.local_diffusion import LocalDiffusionProvider
        illustrator = LocalDiffusionProvider()._illustration

    os.makedirs(out_dir, exist_ok=True)
    raw = os.path.join(out_dir, f"broadcast-{brief.fork_id}-{brief.nation_iso}-{brief.sim_date.year}.raw.mp4")
    duration = assemble_broadcast(brief, illustrator, out_mp4=raw)

    data = open(raw, "rb").read()
    asset = Asset(url=f"file://{raw}", media_type="video/mp4",
                  sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data),
                  duration=round(duration, 2))
    step = Step(provider="local-broadcast", model=f"sdxl-turbo+{tts_backend()}+ffmpeg",
                prompt="(local divergence broadcast)", modality=Modality.VIDEO,
                assets=[asset], metadata={"newspaper": newspaper_fields(brief)})
    run = Run(name=f"broadcast-{brief.fork_id}-{brief.nation_iso}-{brief.sim_date.year}",
              tenant_id=brief.fork_id, steps=[step],
              metadata={"simulation": simulation_metadata(brief)})
    manifest = Manifest.from_run(run)

    final = raw.replace(".raw.mp4", ".mp4")
    Mp4Handler().embed(raw, manifest, output=final)
    os.remove(raw)

    extracted = Mp4Handler().extract(final)
    return {
        "mp4": final,
        "manifest": manifest,
        "canonical_hash": manifest.canonical_hash,
        "duration": round(duration, 2),
        "verified": bool(extracted.verify()),
    }
