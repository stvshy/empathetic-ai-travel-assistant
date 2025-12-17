from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS
import logging


logging.basicConfig()
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

CORS(app, supports_credentials=True)


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

    if size > 0:
        logger.error("it works")  # Your requested log message
        return jsonify({"message": "Audio received successfully"}), 200
    else:
        logger.error("Received audio file is empty")
        return jsonify({"error": "Audio file is empty"}), 400


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000,debug=True)