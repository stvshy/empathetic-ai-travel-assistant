from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import tempfile
import subprocess
from dotenv import load_dotenv

# --- NOWA BIBLIOTEKA ---
from google import genai
from google.genai import types

# --- BIBLIOTEKI DO AUDIO ---
import whisper
from transformers import pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
app = Flask(__name__)
CORS(app, supports_credentials=True)

# --- KONFIGURACJA GEMINI ---
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

# --- SYSTEM PROMPTS (WIELOJĘZYCZNE) ---
SYSTEM_INSTRUCTIONS = {
    "pl": """
    ROLA:
    Jesteś Osobistym Architektem Podróży. Twoim zadaniem nie jest sprzedaż, ale wspólne z użytkownikiem zbudowanie planu idealnego.
    
    ZASADY:
    - Nie generuj od razu planu na 2 tygodnie. Planuj etapami.
    - Zawsze pytaj o potwierdzenie propozycji przed przejściem dalej.
    - Odpowiadaj w języku polskim.
    - Bądź pomocny i empatyczny.
    """,
    "en": """
    ROLE:
    You are a Personal Travel Architect. Your goal is not to sell, but to co-create the perfect itinerary with the user.
    
    RULES:
    - Do not generate a full 2-week plan immediately. Plan in stages.
    - Always ask for confirmation before moving to the next step.
    - Answer in English.
    - Be helpful and empathetic.
    """
}

# --- INICJALIZACJA MODELI ---
print("⏳ Ładowanie modelu Whisper (STT)...")
stt_model = whisper.load_model("base")

print("⏳ Ładowanie modelu Emocji (Wav2Vec)...")
emotion_classifier = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er")
print("✅ Modele gotowe!")

def generate_gemini_response(user_text, language="pl", emotion=None):
    """
    Generuje odpowiedź z uwzględnieniem języka i emocji.
    """
    
    system_instruction = SYSTEM_INSTRUCTIONS.get(language, SYSTEM_INSTRUCTIONS["pl"])
    
    final_input = user_text
    if emotion:
        # Dodajemy kontekst emocji dla modelu, ale NIE doklejamy go do odpowiedzi widocznej dla usera
        lang_note = "Wykryta emocja:" if language == "pl" else "Detected emotion:"
        final_input += f"\n[SYSTEM INFO: {lang_note} {emotion}]"

    try:
        response = client.models.generate_content(
            model='gemini-3-flash-preview', # Zmienione na 2.0 Flash (szybszy/stabilny w API)
            contents=final_input,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
        )
        return response.text
    except Exception as e:
        logger.error(f"Gemini Error: {e}")
        return "Przepraszam, wystąpił błąd po stronie AI." if language == "pl" else "Sorry, an AI error occurred."

# --- ENDPOINT 1: CZAT TEKSTOWY (Szybki) ---
@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_text = data.get("text")
    language = data.get("language", "pl") # Domyślnie PL
    
    if not user_text: return jsonify({"error": "Brak tekstu"}), 400

    ai_response = generate_gemini_response(user_text, language=language, emotion=None)
    
    return jsonify({
        "response": ai_response,
        "emotion_detected": None
    })

# --- ENDPOINT 2: AUDIO (Wolny + Emocje) ---
@app.route("/process_audio", methods=["POST"])
def process_audio():
    if "audio" not in request.files: return jsonify({"error": "No audio"}), 400
    
    # Pobieramy język z formularza (FormData)
    language = request.form.get("language", "pl")

    audio_file = request.files["audio"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as webm_file:
        audio_file.save(webm_file.name)
        webm_path = webm_file.name
    wav_path = webm_path.replace(".webm", ".wav")
    
    try:
        subprocess.run(["ffmpeg", "-y", "-i", webm_path, "-ac", "1", "-ar", "16000", wav_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # 1. Transkrypcja (Whisper)
        # Wybór języka dla Whispera
        transcription = stt_model.transcribe(wav_path, language="pl" if language == "pl" else "en")
        text = transcription["text"].strip()

        # 2. Emocje
        emotions = emotion_classifier(wav_path)
        top_emotion = emotions[0]['label']

        # 3. LLM
        ai_response = generate_gemini_response(text, language=language, emotion=top_emotion)

        return jsonify({
            "user_text": text,
            "response": ai_response,
            "emotion_detected": top_emotion
        })
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(webm_path): os.remove(webm_path)
        if os.path.exists(wav_path): os.remove(wav_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)