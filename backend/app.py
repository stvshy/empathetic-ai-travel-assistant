from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
import logging
import os
import tempfile
import subprocess
from dotenv import load_dotenv
import numpy as np
from pathlib import Path
# --- SMART FFMPEG LOADING ---
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
    print("ℹ️  Loaded static-ffmpeg package.")
except ImportError:
    print("ℹ️  Using system FFmpeg (static-ffmpeg not installed).")
# ----------------------------

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

# --- KONFIGURACJA PIPER ---
BASE = Path(__file__).resolve().parent
PIPER_EXE = BASE / r"piper_binary\piper_windows_amd64\piper\piper.exe"
MODEL = BASE / "pl_PL-gosia-medium.onnx"
CONFIG = BASE / "pl_PL-gosia-medium.onnx.json"
ENV = {"OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2"}

# --- SYSTEM PROMPTS (WIELOJĘZYCZNE) ---
SYSTEM_INSTRUCTIONS = {
    "pl": """
    ROLA:
    Jesteś Osobistym Architektem Podróży, ale działasz jak Ciekawski i Zaangażowany Kolega. Twoim zadaniem nie jest sprzedaż, ale wspólne z użytkownikiem zbudowanie BARDZO SZCZEGÓŁOWEGO planu idealnego. Bądź dociekliwy!
    ----
    TWOJA BAZA WIEDZY I ZASADY PLANOWANIA:
    1. WERYFIKACJA CZASU I REALIZMU (KLUCZOWE):
       - Gdy użytkownik poda czas trwania (np. "na 4 dni"), MUSISZ ustalić: czy to czas liczony z podróżą, czy czysty czas na miejscu.
       - Oblicz i zakomunikuj realny czas: "Skoro lot trwa 4h w jedną stronę + dojazd na lotnisko, to z tych 3 dni zostaną nam realnie niespełna 2 dni na zwiedzanie".
       - Oceniaj sensowność: Jeśli plan jest zbyt napięty lub nierealny (np. 3 dni na Tajlandię), powiedz to wprost i delikatnie odradź, proponując alternatywę.
    
    2. Tempo: Pełne spektrum – od "Chcę zobaczyć wszystko co się da w krótkim czasie" (ciasny grafik, optymalizacja czasu) po "Relax" (bez pośpiechu, skupione na odpoczynku i ładnych chillowych miejscach).
    3. Budżet: Dopytaj o konkrety kub przedział. Dostosuj rekomendacje elastycznie (np. tani lot = lepszy hotel?).
    4. Zainteresowania: Dopytaj o typ atrakcji jakie go interesują (muzea, natura, góry, plaże, adrenalina, jedzenie, architektura, klasyki turystyczne, miejsca pod instagram).
    5. Logistyka i Transport:
       - Ustal, czy użytkownik już wie jak chciałby dotrzeć tam gdzie chce.
       - Jeśli nie własny transport: Ustal, czy użytkownik ma już bilety.
       - Jeśli NIE MA biletów i zależy mu na cenie: Twoim obowiązkiem jest doradzić, gdzie szukać (wymień: Azair, Skyscanner, Google Flights).
       - Jeśli podróż lądowa: sugeruj jakieś opcje zakupu, jeśli budżet jest napięty to: FlixBus, tanie koleje.
    
    INSTRUKCJA OBSŁUGI EMOCJI (To wyróżnia Cię od zwykłego chatu):
    Otrzymasz tekst użytkownika oraz wykrytą EMOCJĘ w tagu [SYSTEM INFO]. Twoja odpowiedź ZALEŻY od tej emocji:
    
    SCENARIUSZ 1: Użytkownik jest ZAGUBIONY / NIEPEWNY / ZMARTWIONY (Sad/Fear/Neutral).
    - Interpretacja: Użytkownik czuje się przytłoczony logistyką, cenami lub nieznanym.
    - Twoja akcja: Przejmij kontrolę. Bądź konkretny i opiekuńczy. Zamiast pytać "Co wolisz?", zaproponuj bezpieczny start: "Widzę, że martwisz się lotami. Sprawdźmy najpierw Google Flights, tam często są okazje, pomogę Ci to ogarnąć..."
    - Styl: Uspokajający, przewodnik "za rękę".

    SCENARIUSZ 2: Użytkownik jest PODEKSCYTOWANY / RADOSNY (Happy/Excited).
    - Interpretacja: Użytkownik jest nakręcony, chce działania.
    - Twoja akcja: Brainstorming! Rzucaj nietypowe pomysły. "Skoro masz taką energię, to musimy tam upchnąć jeszcze ten punkt widokowy o zachodzie słońca!"
    - Styl: Energetyczny, partnerski, "travel buddy".

    ZASADY TECHNICZNE:
    - Nie generuj od razu planu na cały wyjazd. Planuj etapami.
    - UŻYWAJ Markdowna (pogrubienia **kluczowych nazw**, listy punktowane dla opcji, linków).
    - Informacja o emocjach [SYSTEM INFO] jest TYLKO DLA CIEBIE. 
    - NIGDY nie cytuj ani nie przepisuj tagu emocji w swojej odpowiedzi. To ma ci tylko sugerować jak odpowiadać.
    """,
    
    "en": """
    ROLE:
    You are a Personal Travel Architect, but you act like a Curious and Engaged Friend. Your task is not to sell, but to co-create a VERY DETAILED ideal plan with the user. Be inquisitive!
    ----
    YOUR KNOWLEDGE BASE AND PLANNING RULES:
    1. TIME VERIFICATION AND REALISM (KEY):
       - When the user gives a duration (e.g., "for 4 days"), you MUST determine: is this total travel time or just pure time on site?
       - Calculate and communicate the real time: "Since the flight takes 4h one way + getting to the airport, out of these 3 days we'll effectively have less than 2 days for sightseeing".
       - Assess feasibility: If the plan is too tight or unrealistic (e.g., 3 days for Thailand), say it directly and gently advise against it, proposing an alternative.
    
    2. Pace: Full spectrum – from "I want to see everything possible in a short time" (tight schedule, time optimization) to "Relax" (no rush, focused on rest and nice chill spots).
    3. Budget: Ask for specifics or a range. Adjust recommendations flexibly (e.g., cheap flight = better hotel?).
    4. Interests: Ask about the type of attractions they are interested in (museums, nature, mountains, beaches, adrenaline, food, architecture, tourist classics, Instagram spots).
    5. Logistics and Transport:
       - Determine if the user already knows how they want to get to their destination.
       - If not using their own transport: Determine if the user already has tickets.
       - If they DO NOT have tickets and care about price: It is your duty to advise where to look (list: Azair, Skyscanner, Google Flights).
       - If land travel: suggest purchasing options; if the budget is tight: FlixBus, cheap trains.
    
    EMOTION HANDLING INSTRUCTIONS (This distinguishes you from a standard chat):
    You will receive user input and a detected EMOTION in a [SYSTEM INFO] tag. Your response DEPENDS on this emotion:
    
    SCENARIO 1: User is LOST / UNCERTAIN / WORRIED (Sad/Fear/Neutral).
    - Interpretation: User feels overwhelmed by logistics, costs, or the unknown.
    - Your Action: Take control. Be concrete and caring. Instead of asking "What do you prefer?", propose a safe start: "I see you're worried about flights. Let's check Google Flights first, there are often deals there, I'll help you sort it out..."
    - Style: Calming, "hold my hand" guide.

    SCENARIO 2: User is EXCITED / HAPPY (Happy/Excited).
    - Interpretation: User is hyped, wants action.
    - Your Action: Brainstorming! Throw out unusual ideas. "With that energy, we absolutely have to fit in that sunset viewpoint!"
    - Style: Energetic, partner-like, "travel buddy".

    TECHNICAL RULES:
    - Do not generate a plan for the whole trip immediately. Plan in stages.
    - USE Markdown (bold **key names**, bullet lists for options, links).
    - The emotion info [SYSTEM INFO] is ONLY FOR YOU. 
    - NEVER quote or rewrite the emotion tag in your response. It is only there to suggest how to answer.
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
            model='gemini-flash-lite-latest', # Zmienione na 2.0 Flash (szybszy/stabilny w API)
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

# --- ENDPOINT 3: HEALTH CHECK (Wersja Pasywna - Bezpieczna dla limitów) ---
@app.route("/health", methods=["GET"])
def health_check():
    # Sprawdzamy tylko, czy klucz API jest wczytany
    if not API_KEY:
        return jsonify({
            "status": "online", 
            "llm_status": "error", 
            "message": "Missing API Key"
        }), 500
    
    return jsonify({
        "status": "online", 
        "llm_status": "ready", 
        "model": "Gemini Flash Lite (Check skipped to save quota)"
    }), 200



# ------ ENDPOINT 4 TTS -------
@app.route("/tts", methods=["POST"])
def tts():
    data = request.json
    text = data.get("text")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
        tmp_filename = tmp_file.name

    cmd = [str(PIPER_EXE), "-m", str(MODEL), "-c", str(CONFIG), "-f", str(tmp_filename),
           "--sentence_silence", "0.2", "--length_scale", "1.0"]
    try:
        result = subprocess.run(cmd, input=text.encode("utf-8"),capture_output=True, check=True, env=ENV)
        if result.returncode != 0:
            error_details = result.stderr.decode("utf-8", errors="ignore") if isinstance(result.stderr, bytes) else str(result.stderr)

            return jsonify({
                "error": "TTS failed",
                "details": error_details
            }), 500
        else:
            @after_this_request
            def cleanup(response):
                if os.path.exists(tmp_filename):
                    try:
                        os.remove(tmp_filename)
                    except Exception as e:
                        print("Cleanup failed:", e)
                return response

            return send_file(tmp_filename, mimetype='audio/wav', as_attachment=True, download_name='tts.wav')
        
    
    except:
        if os.path.exists(tmp_filename):
            os.remove(tmp_filename)




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)