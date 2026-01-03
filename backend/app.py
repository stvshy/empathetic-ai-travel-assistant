from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS
import logging
import whisper
import os
import tempfile
from transformers import pipeline
import subprocess


logging.basicConfig()
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

CORS(app, supports_credentials=True)


model = whisper.load_model("turbo")
classifier = pipeline("audio-classification",model="superb/wav2vec2-base-superb-er")


@app.route("/process", methods=["POST"])
def process():
    if "audio" not in request.files:
        logger.error("No audio part in the request")
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]

    if audio_file.filename == "":
        logger.error("No selected audio file")
        return jsonify({"error": "No audio file selected"}), 400

    # Check file size
    audio_file.seek(0, 2)  # Move to end of file
    size = audio_file.tell()
    audio_file.seek(0)     # Reset file pointer to start

    translation_output = None
    emotion_output = None

    if size > 0:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as webm_file:
            audio_file.save(webm_file.name)
            webm_path = webm_file.name
        try:
            result = model.transcribe(webm_path,language="polish")

            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav:
                wav_path = wav.name

            try:
                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-i", webm_path,
                        "-ac", "1",
                        "-ar", "16000",
                        wav_path
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

                outputs = classifier(wav_path, top_k=None)
                logging.error(outputs)
                emotion_output = outputs

            finally:
                os.remove(wav_path)

            logging.error(result["text"])
            translation_output = result["text"]
            return jsonify({"translation": translation_output, "emotions":emotion_output}), 200
        except Exception as e:
            logger.exception("AI failed")
            return jsonify({"error": "Transcription failed"}), 500
        finally:
            os.remove(webm_path)
    else:
        logger.error("Received audio file is empty")
        return jsonify({"error": "Audio file is empty"}), 400


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000,debug=True)