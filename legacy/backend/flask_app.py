import os
import sys
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import io
import wave
import tempfile
import traceback
from mistralai import Mistral
from dotenv import load_dotenv

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.constants import (
    ELEVENLABS_MODEL_V2T,
    MISTRAL_MODEL,
    WEB_JS_SYSTEM_PROMPT,
)
from app.narrator import client as eleven_client

load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/vibe-shift", methods=["POST"])
def vibe_shift():
    try:
        data = request.json
        user_intent = data.get("user_intent", "")

        response = mistral_client.chat.complete(
            model=MISTRAL_MODEL,
            messages=[
                {"role": "system", "content": WEB_JS_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"The player says: '{user_intent}'. You are the Architect. Shift reality using JavaScript. Respond only in JSON.",
                },
            ],
        )
        content = response.choices[0].message.content
        print(f"MISTRAL RESPONSE: {content}")

        with open("vibe_shifts.log", "a", encoding="utf-8") as f:
            f.write(f"--- {user_intent} ---\n{content}\n\n")

        return jsonify({"code": content})
    except Exception as e:
        print(f"MISTRAL ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    try:
        audio_data = file.read()
        if len(audio_data) < 1000:
            return jsonify({"error": "Audio too small"}), 400

        suffix = ".webm" if "webm" in file.content_type else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as f:
                transcription = eleven_client.speech_to_text.convert(
                    file=f,
                    model_id=ELEVENLABS_MODEL_V2T,
                    tag_audio_events=False,
                    language_code="eng",
                )
            return jsonify({"text": transcription.text})
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
