import os
import io
import time
from dotenv import load_dotenv

import wave
import sounddevice as sd

from elevenlabs.client import ElevenLabs
from elevenlabs import stream

from utils.constants import ELEVENLABS_MODEL_V2T, ELEVENLABS_MODEL_T2V

load_dotenv()
client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

_recording_data = []
_stream = None


def start_recording():
    """Starts asynchronous recording."""
    global _recording_data, _stream
    import numpy as np

    _recording_data = []

    def callback(indata, frames, time, status):
        if status:
            print(status)
        _recording_data.append(indata.copy())

    _stream = sd.InputStream(
        samplerate=16000, channels=1, dtype="int16", callback=callback
    )
    _stream.start()
    print("Recording started...")


def stop_and_transcribe():
    """Stops recording and sends to ElevenLabs."""
    global _stream, _recording_data
    if not _stream:
        return ""

    _stream.stop()
    _stream.close()
    _stream = None
    print("Recording stopped. Processing...")

    import numpy as np
    import wave

    # Concatenate all recorded chunks
    audio = np.concatenate(_recording_data)
    fs = 16000

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(fs)
        wf.writeframes(audio.tobytes())
    buffer.seek(0)

    print("Transcribing via ElevenLabs...")
    curr_time = time.time()
    try:
        transcription = client.speech_to_text.convert(
            file=buffer,
            model_id=ELEVENLABS_MODEL_V2T,
            tag_audio_events=False,
            language_code="eng",
        )
        full_text = transcription.text
        print(f"Architect heard: {full_text}")
        print(f"Transcription took {time.time() - curr_time:.2f} seconds")
        return full_text
    except Exception as e:
        print(f"ElevenLabs STT Error: {e}")
        return ""


def announce_vibe_shift(text, voice_id="pNInz6obpgDQGcFmaJgB"):
    """
    Streams audio directly to speakers.
    Use this for the 'Game Architect' persona.
    """
    try:
        audio_stream = client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id=ELEVENLABS_MODEL_T2V,
            output_format="mp3_44100_128",
        )
        stream(audio_stream)
    except Exception as e:
        print(f"ElevenLabs Error: {e}")


def architect_commentary(event_type):
    lines = {
        "intro": "Welcome to the Brawl! Let's shake things up.",
        "hard_mode": "You're struggling. Let me rewrite the physics to favor you.",
        "success": "Reality patched. Try not to break this one.",
        "glitch": "The logic is fracturing. Hold on!",
    }
    announce_vibe_shift(lines.get(event_type, "Proceeding."))


def npc_dialogue(npc_name, dialogue):
    if npc_name == "Player":  # player
        voice_id = "fgDJOgmENIR82PueQrVs"
    elif npc_name == "Elder":  # ally
        voice_id = "oR4uRy4fHDUGGISL0Rev"
    elif npc_name == "Guard":  # ally
        voice_id = "si0svtk05vPEuvwAW93c"
    elif npc_name == "Lillith":  # villain
        voice_id = "mLw8kuDeVGqVstOYjRII"
    else:  # architect
        voice_id = "pNInz6obpgDQGcFmaJgB"

    announce_vibe_shift(dialogue, voice_id=voice_id)


if __name__ == "__main__":
    result = record_and_transcribe()
    print(f"Final Transcription: {result}")
