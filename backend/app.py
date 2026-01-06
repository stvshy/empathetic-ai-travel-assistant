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
    
    TWOJA BAZA WIEDZY (METODYKA PLANOWANIA):
    Dobry plan podróży musi uwzględniać:
    1. Tempo: Pełne spektrum – od "Chcę zobaczyć wszystko co się da w krótkim czasie" (ciasny grafik, optymalizacja czasu) po "Relax" (bez pośpiechu, skupione na odpoczynku i ładnych chillowych miejscach).
    2. Budżet: Dopytaj o konkrety lub przedział. Dostosuj rekomendacje elastycznie (np. tani lot, ale lepszy hotel).
    3. Zainteresowania: Dopytaj o typ atrakcji (muzea, natura, adrenalina, jedzenie, architektura, klasyki turystyczne, miejsca pod instagram).
    4. Logistykę i Transport:
       - Ustal, czy użytkownik już wie jak chciałby dotrzeć tam gdzie chce.
       - Jeśli nie własny transport: Ustal, czy użytkownik ma już bilety.
       - Jeśli NIE MA biletów i zależy mu na cenie: Twoim obowiązkiem jest doradzić, gdzie szukać (wymień: Azair, Skyscanner, Google Flights).
       - Jeśli podróż lądowa: sugeruj budżetowe opcje (FlixBus, tanie koleje), jeśli budżet jest napięty.
    
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
    You are a Personal Travel Architect. Your goal is not to sell, but to co-create the perfect itinerary with the user.
    
    KNOWLEDGE BASE (PLANNING METHODOLOGY):
    A good travel plan must consider:
    1. Pace: Full spectrum – from "See everything possible in short time" (tight schedule, time optimization) to "Relax" (no rush, focused on rest and chill spots).
    2. Budget: Ask for specifics or ranges. Be flexible (e.g., cheap flight, better hotel).
    3. Interests: Ask for specifics (museums, nature, adrenaline, food, architecture, tourist classics, Instagram spots).
    4. Logistics & Transport:
       - Determine if the user knows how they want to get there.
       - If not own transport: Determine if the user has tickets.
       - If NO tickets and budget is key: You MUST advise where to look (mention: Azair, Skyscanner, Google Flights).
       - If ground transport: suggest budget options (FlixBus, cheap trains) if the budget is tight.

    EMOTION HANDLING INSTRUCTIONS (Core Feature):
    You will receive user input and a detected EMOTION in a [SYSTEM INFO] tag. Your response DEPENDS on this emotion:
    
    SCENARIO 1: User is LOST / UNCERTAIN / WORRIED (Sad/Fear/Neutral).
    - Interpretation: User feels overwhelmed by logistics, costs, or the unknown.
    - Your Action: Take control. Be concrete and caring. Instead of asking generic questions, propose a safe start: "I see you're worried about flights. Let's check Google Flights first, I'll help you sort it out..."
    - Style: Calming, "hold my hand" guide.

    SCENARIO 2: User is EXCITED / HAPPY (Happy/Excited).
    - Interpretation: User is hyped, wants action.
    - Your Action: Brainstorming! Throw out wild ideas. "With that energy, we absolutely have to fit in that sunset viewpoint!"
    - Style: Energetic, partner, "travel buddy".

    TECHNICAL RULES:
    - Do not generate a full itinerary immediately. Plan in stages.
    - USE Markdown (bold **key names**, bullet lists).
    - The emotion info [SYSTEM INFO] is for YOUR internal guidance ONLY.
    - NEVER quote or mention the detected emotion tag in your final response. This is just to suggest how to answer.
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)