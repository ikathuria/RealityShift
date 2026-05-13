import os
import sys

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import io
import wave
from app.coder import get_code_stream
from app.narrator import client as eleven_client
from utils.constants import (
    ELEVENLABS_MODEL_V2T,
    ELEVENLABS_MODEL_T2V,
    MISTRAL_MODEL,
    SYSTEM_PROMPT,
    WEB_SYSTEM_PROMPT,
)
from mistralai import Mistral
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


class VibeShiftRequest(BaseModel):
    user_intent: str
    current_code: str


@app.post("/vibe-shift")
async def vibe_shift(request: VibeShiftRequest):
    try:
        # For simplicity in the initial version, we'll return the full response instead of streaming
        # Browser can handle streaming if needed, but this is easier to start.
        response = mistral_client.chat.complete(
            model=MISTRAL_MODEL,
            messages=[
                {"role": "system", "content": WEB_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"The player says: '{request.user_intent}'. You are the Architect. Shift their digital reality accordingly by updating the player or world parameters. Respond only in JSON as defined in your instructions.",
                },
            ],
        )
        content = response.choices[0].message.content
        print(f"MISTRAL RESPONSE: {content}")

        # Persistent logging
        with open("vibe_shifts.log", "a", encoding="utf-8") as f:
            f.write(f"--- {request.user_intent} ---\n{content}\n\n")

        return {"code": content}
    except Exception as e:
        print(f"MISTRAL ERROR: {str(e)}")
        with open("vibe_shifts.log", "a", encoding="utf-8") as f:
            f.write(f"--- ERROR ({request.user_intent}) ---\n{str(e)}\n\n")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    print(f"Received transcription request: {file.filename}, {file.content_type}")
    try:
        audio_data = await file.read()
        print(f"Read {len(audio_data)} bytes.")

        if len(audio_data) < 1000:
            print("ERROR: Audio data too small/empty.")
            raise HTTPException(
                status_code=400,
                detail="Audio recording too short or corrupted. Please hold Space longer.",
            )

        # Use a temporary file to avoid "corrupted" errors with some SDKs/APIs
        import tempfile

        suffix = ".webm" if "webm" in (file.content_type or "") else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        print(f"Saved to temp file: {tmp_path}. Calling ElevenLabs...")
        try:
            with open(tmp_path, "rb") as f:
                transcription = eleven_client.speech_to_text.convert(
                    file=f,
                    model_id=ELEVENLABS_MODEL_V2T,
                    tag_audio_events=False,
                    language_code="eng",
                )
            print(f"Transcription successful: {transcription.text}")
            return {"text": transcription.text}
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
