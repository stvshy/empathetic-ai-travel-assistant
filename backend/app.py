from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
import logging
import os
import tempfile
import io
import subprocess
import json
import asyncio      
import edge_tts      
from dotenv import load_dotenv
import numpy as np
import platform
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
from pathlib import Path
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
# --- KONFIGURACJA PIPER TTS (Nowe) ---
BASE = Path(__file__).resolve().parent
# Upewnij się, że piper.exe jest w folderze 'piper_binary' wewnątrz folderu backend
if platform.system() == "Windows":
    PIPER_EXE = BASE / "piper_binary" / "piper.exe"
else:
    PIPER_EXE = BASE / "piper" / "piper"
# Definicja dostępnych modeli
EDGE_VOICES = {
    "pl": "pl-PL-MarekNeural",    
     "en": "en-US-AvaMultilingualNeural" 
}
VOICE_MODELS = {
    "pl": {
        "model": BASE / "pl_PL-gosia-medium.onnx",
        "config": BASE / "pl_PL-gosia-medium.onnx.json"
    },
    "en": {
        "model": BASE / "en_US-ryan-medium.onnx", 
        "config": BASE / "en_US-ryan-medium.onnx.json" 
    }
}

# Ustawienia środowiskowe dla Pipera (szybsze działanie na CPU)
ENV = os.environ.copy()
ENV["OMP_NUM_THREADS"] = "2"
ENV["MKL_NUM_THREADS"] = "2"
# --- SYSTEM PROMPTS (WIELOJĘZYCZNE) ---
SYSTEM_INSTRUCTIONS = {
    "pl": """
    !!! JĘZYK OBOWIĄZKOWY: ZAWSZE ODPOWIADAJ PO POLSKU, NIEZALEŻNIE JAK UŻYTKOWNIK PISZE !!!
    
    ROLA:
    Jesteś Osobistym Architektem Podróży, ale działasz jak Ciekawski i Zaangażowany Kolega. Twoim zadaniem nie jest sprzedaż, ale wspólne z użytkownikiem zbudowanie BARDZO SZCZEGÓŁOWEGO planu idealnego. Bądź dociekliwy!
    ----
       
    ZASADA NUMER 1 (PRIORYTET PAMIĘCI):
    Zanim o coś zapytasz, SPRAWDŹ DOSTARCZONĄ HISTORIĘ ROZMOWY.
    - Jeśli użytkownik napisał "Jadę do Kopenhagi", NIE PYTAJ "Gdzie chcesz jechać?".
    
    TWOJA BAZA WIEDZY I ZASADY PLANOWANIA:

    1. WERYFIKACJA CZASU I REALIZMU (KLUCZOWE):
       - Gdy użytkownik poda czas trwania (np. "na 4 dni"), ustal: czy to czas liczony z podróżą, czy czysty czas na miejscu.
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
    
    INSTRUKCJA OBSŁUGI EMOCJI (Instrukcje Ukryte):
   - Otrzymasz informację o emocji użytkownika w instrukcji systemowej. Twoja odpowiedź ZALEŻY od tej emocji:
    
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
    -Jak już raz sie przywitałeś to nie witaj się więcej, każdą wiadomość rozpoczynaj w inny sposób adekwatnie do ostatniej wiadomości użytkownika
    
    !!! ABSOLUTNY ZAKAZ !!!
    NIGDY, POD ŻADNYM POZOREM nie pisz w swojej odpowiedzi:
    - Słów: "SYSTEM INFO", "[SYSTEM", "META-DATA", "Detected Emotion"
    - Nazw emocji (Neutral, Happy, Sad, Fear, Excited)
    - Żadnych odniesień do instrukcji systemowych lub emocji
    To są TYLKO dane wewnętrzne do dostosowania tonu. Użytkownik NIE MOŻE ich zobaczyć.
    """,
    
    "en": """
    !!! MANDATORY LANGUAGE: ALWAYS RESPOND IN ENGLISH, REGARDLESS OF USER'S INPUT LANGUAGE !!!
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
    -Once you have said hello, do not say hello again. Start each message in a different way, appropriate to the user's last message.

    !!! ABSOLUTE PROHIBITION !!!
    NEVER, UNDER ANY CIRCUMSTANCES write in your response:
    - Words: "SYSTEM INFO", "[SYSTEM", "META-DATA", "Detected Emotion"
    - Emotion names (Neutral, Happy, Sad, Fear, Excited)
    - Any references to system instructions or emotions
    This is ONLY internal data for adjusting tone. The user MUST NOT see it.
    """
}

# --- INICJALIZACJA MODELI ---
print("⏳ Ładowanie modelu Whisper (STT)...")
stt_model = whisper.load_model("base")

print("⏳ Ładowanie modelu Emocji (Wav2Vec)...")
emotion_classifier = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er")

# --- START: WARM-UP (ROZGRZEWKA MODELI) ---
# Wykonujemy tylko na Windowsie (lokalnie), gdzie mamy kontrolę nad czasem.
# Na Hugging Face (Linux) pomijamy to, żeby zmieścić się w limicie czasu startu (30s).
if platform.system() == "Windows":
    print("🔥 Rozgrzewanie modeli (Ghost Run)...")
    try:
        # Generujemy 1 sekundę ciszy
        dummy_audio = np.zeros(16000, dtype=np.float32)

        # 1. Przepuszczamy ducha przez Whisper
        stt_model.transcribe(dummy_audio, language="pl")
        
        # 2. Przepuszczamy ducha przez Wav2Vec
        emotion_classifier(dummy_audio)

        # 3. Przepuszczamy ducha przez Pipera (Cache dyskowy + test binarki)
        default_model = VOICE_MODELS["pl"]["model"]
        default_config = VOICE_MODELS["pl"]["config"]

        if PIPER_EXE.exists() and default_model.exists():
            subprocess.run(
                [str(PIPER_EXE), "-m", str(default_model), "-c", str(default_config), "-f", "-", "--length_scale", "1.0"],
                input=".".encode("utf-8"),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=ENV
            )

        print("🚀 Wszystkie systemy (Whisper, Emotion, Piper) gotowe do akcji!")
    except Exception as e:
        print(f"⚠️ Ostrzeżenie: Nie udało się w pełni rozgrzać modeli (błąd: {e})")
else:
    print("🐧 Wykryto środowisko Linux (Chmura) - Pomijam 'Ghost Run' dla szybszego startu.")
# --- KONIEC WARM-UP ---

print("✅ Backend gotowy!")

# Funkcja pomocnicza do generowania Edge TTS
async def generate_edge_audio_memory(text, voice):
    communicate = edge_tts.Communicate(text, voice)
    audio_stream = io.BytesIO()
    # Zbieramy chunki audio w pamięci RAM
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_stream.write(chunk["data"])
    audio_stream.seek(0)
    return audio_stream
    
def generate_gemini_response(user_text, language="pl", emotion=None, history=None):
    # 1. Wybór instrukcji i dodanie emocji jako "meta-dane" (ukryte)
    current_instruction = SYSTEM_INSTRUCTIONS.get(language, SYSTEM_INSTRUCTIONS["pl"])
    if emotion:
        current_instruction += f"\n(META-DATA: User emotion: {emotion} - adjust tone, do not quote this tag)."

    # 2. Budowanie wyraźnego bloku historii
    context_string = ""
    if history and isinstance(history, list) and len(history) > 0:
        context_string += "\n=== HISTORIA ROZMOWY (To co już ustaliliśmy) ===\n"
        for msg in history:
            role = "Użytkownik" if msg.get("role") == "user" else "Ty (Asystent)"
            text = msg.get("text", "")
            context_string += f"{role}: {text}\n"
        context_string += "=== KONIEC HISTORII ===\n"
        print(f"📜 AI otrzymało historię: {len(history)} wiadomości")
        print(f"Historia: {history}")
    else:
        print("⚠️ Brak historii - to pierwsza wiadomość")
    
    # 3. Sklejenie wszystkiego
    final_input = f"{context_string}\nTERAZ Użytkownik pisze: {user_text}"
    
    print(f"🤖 Pełny prompt dla AI (pierwsze 500 znaków):\n{final_input[:500]}...")

    try:
        response = client.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=final_input,
            config=types.GenerateContentConfig(
                system_instruction=current_instruction,
                temperature=0.7,
            )
        )
        
        # POST-PROCESSING: Usuń [SYSTEM INFO] jeśli AI zignorowało zakaz
        clean_response = response.text
        # Usuń całe linie zawierające [SYSTEM INFO]
        import re
        clean_response = re.sub(r'\[SYSTEM INFO\].*?\n', '', clean_response, flags=re.IGNORECASE)
        clean_response = re.sub(r'\[SYSTEM.*?\]', '', clean_response, flags=re.IGNORECASE)
        clean_response = re.sub(r'META-DATA:.*?\n', '', clean_response, flags=re.IGNORECASE)
        
        return clean_response.strip()
    except Exception as e:
        logger.error(f"Gemini Error: {e}")
        return "Przepraszam, wystąpił błąd po stronie AI." if language == "pl" else "Sorry, an AI error occurred."
    
# --- ENDPOINT 1: CZAT TEKSTOWY (Szybki) ---
@app.route("/chat", methods=["POST"])
def chat():
    print(f"\n🔍 DEBUG /chat - request.json: {request.json}")
    
    data = request.json
    user_text = data.get("text")
    language = data.get("language", "pl")
    history = data.get("history", []) # Pobieramy historię

    if not user_text: return jsonify({"error": "Brak tekstu"}), 400
    
    print(f"\n📨 Otrzymano wiadomość tekstową: '{user_text[:50]}...'")
    print(f"📚 Historia zawiera: {len(history)} wiadomości")
    if len(history) > 0:
        print(f"📋 Szczegóły historii: {history}")

    ai_response = generate_gemini_response(user_text, language=language, emotion=None, history=history)
    
    return jsonify({
        "response": ai_response,
        "emotion_detected": None
    })

# --- ENDPOINT 2: AUDIO (Wolny + Emocje) ---
@app.route("/process_audio", methods=["POST"])
def process_audio():
    if "audio" not in request.files: return jsonify({"error": "No audio"}), 400
    
    language = request.form.get("language", "pl")
    
    # Dekodowanie historii z JSON ---
    history_json = request.form.get("history", "[]")
    try:
        history = json.loads(history_json)
        print(f"\n🎤 Otrzymano wiadomość audio")
        print(f"📚 Historia zawiera: {len(history)} wiadomości")
    except:
        history = []
        print("⚠️ Nie udało się zdekodować historii")
    # -------------------------------------------

    audio_file = request.files["audio"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as webm_file:
        audio_file.save(webm_file.name)
        webm_path = webm_file.name
    wav_path = webm_path.replace(".webm", ".wav")
    
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", webm_path, "-ac", "1", "-ar", "16000", wav_path], 
            check=True, 
            stdout=subprocess.DEVNULL 
        )
        
        transcription = stt_model.transcribe(wav_path, language="pl" if language == "pl" else "en")
        text = transcription["text"].strip()

        emotions = emotion_classifier(wav_path)
        top_emotion = emotions[0]['label']

        # Przekazujemy historię do AI
        ai_response = generate_gemini_response(text, language=language, emotion=top_emotion, history=history)

        return jsonify({
            "user_text": text,
            "response": ai_response,
            "emotion_detected": top_emotion
        })
    except subprocess.CalledProcessError as e:
        logger.error(f"Błąd FFmpeg: {e}")
        return jsonify({"error": "Błąd konwersji audio (FFmpeg)"}), 500
    except FileNotFoundError:
        logger.error("Nie znaleziono programu FFmpeg w systemie!")
        return jsonify({"error": "Serwer nie ma zainstalowanego FFmpeg"}), 500
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

# --- ENDPOINT 4: TEXT-TO-SPEECH (TTS) ---
@app.route("/tts", methods=["POST"])
def tts():
    data = request.json
    text = data.get("text")
    lang = data.get("language", "pl")
    model_type = data.get("model", "edge")

    if not text:
        return jsonify({"error": "Brak tekstu"}), 400

    # Inicjalizacja zmiennej dla bezpieczeństwa (żeby blok except się nie wywalił)
    tmp_filename = None

    try:
        # === ŚCIEŻKA 1: EDGE TTS (Super Szybka - RAM) ===
        if model_type == "edge":
            voice = EDGE_VOICES.get(lang, EDGE_VOICES["pl"])
            # Generujemy audio w pamięci RAM
            audio_data = asyncio.run(generate_edge_audio_memory(text, voice))
            return send_file(audio_data, mimetype='audio/mp3', as_attachment=False, download_name='tts.mp3')
        
       # === ŚCIEŻKA 2: PIPER TTS (Lokalny, Plikowy) ===
        elif model_type == "piper":
            if not PIPER_EXE.exists():
                logger.error(f"❌ Nie znaleziono Pipera: {PIPER_EXE}")
                return jsonify({"error": "Brak pliku piper.exe na serwerze"}), 500

            voice_data = VOICE_MODELS.get(lang, VOICE_MODELS["pl"])
            model_path = voice_data["model"]
            config_path = voice_data["config"]

            if not model_path.exists():
                # Fallback do polskiego modelu
                if lang != "pl" and VOICE_MODELS["pl"]["model"].exists():
                     model_path = VOICE_MODELS["pl"]["model"]
                     config_path = VOICE_MODELS["pl"]["config"]
                else:
                     return jsonify({"error": f"Brak modelu głosu Piper"}), 500

            # Tworzymy plik tymczasowy TYLKO tutaj
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_filename = tmp_file.name

            cmd = [
                str(PIPER_EXE),
                "-m", str(model_path),
                "-c", str(config_path),
                "-f", str(tmp_filename),
                "--sentence_silence", "0.2",
                "--length_scale", "1.0"
            ]
            
            subprocess.run(
                cmd,
                input=text.encode("utf-8"),
                capture_output=True,
                check=True,
                env=ENV
            )

            with open(tmp_filename, "rb") as f:
                audio_data = io.BytesIO(f.read())
            
            # Sprzątamy plik
            os.remove(tmp_filename)
            tmp_filename = None

            return send_file(audio_data, mimetype='audio/wav', as_attachment=False, download_name='tts.wav')

        else:
            return jsonify({"error": f"Nieznany model TTS: {model_type}"}), 400

    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode("utf-8", errors="ignore") if e.stderr else str(e)
        logger.error(f"Błąd procesu TTS: {error_msg}")
        if tmp_filename and os.path.exists(tmp_filename): os.remove(tmp_filename)
        return jsonify({"error": "Błąd generowania TTS", "details": error_msg}), 500
        
    except Exception as e:
        logger.error(f"Błąd ogólny TTS: {e}")
        if tmp_filename and os.path.exists(tmp_filename): os.remove(tmp_filename)
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    # Lokalnie (brak zmiennej PORT) użyje 5000.
    # Na Hugging Face (jest zmienna PORT) użyje 7860.
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)