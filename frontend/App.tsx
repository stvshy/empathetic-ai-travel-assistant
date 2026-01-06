import React, { useState, useEffect, useRef } from "react";
import { Message, AppState, Settings } from "./types";
import ChatBubble from "./components/ChatBubble";

// --- SŁOWNIK TŁUMACZEŃ ---
const TRANSLATIONS = {
  pl: {
    title: "Asystent Podróży",
    available: "Dostępny",
    unavailable: "Niedostępny",
    inputPlaceholder: "Napisz wiadomość...",
    listening: "Słucham...",
    processing: "Przetwarzam...",
    serverError: "Błąd serwera.",
    micError: "Błąd mikrofonu",
    backendError: "Błąd backendu.",
    settingsTitle: "Ustawienia",
    langLabel: "Język",
    predefinedLabel: "Szybkie Profile",
    advancedLabel: "Zaawansowane",
    inputModelLabel: "Model Rozpoznawania Mowy (STT)",
    voiceModelLabel: "Model Głosu (TTS)",
    whisperWarning:
      "Whisper wydłuża czas odpowiedzi i wymaga wciśnięcia przycisku, kiedy skończysz mówić (nie działa automatycznie)",
    webDesc: "Szybki, brak emocji",
    whisperDesc: "Wolniejszy, dokładniejszy",
    featuresLabel: "Funkcje",
    enableEmotions: "Wykrywanie Emocji",
    enableTTS: "Czytanie Wiadomości (TTS)",
    recordingStart: "Jeśli skończysz mówić wciśnij czerwony przycisk na dole",
    profileFast: "Szybki ⚡",
    profileFastDesc: "Przeglądarka • Bez Emocji",
    profileEmp: "Empatyczny ❤️",
    profileEmpDesc: "Whisper AI • Emocje",
    copyright: "Mateusz Staszków. Wszelkie prawa zastrzeżone.",
  },
  en: {
    title: "Travel Assistant",
    available: "Available",
    unavailable: "Unavailable",
    inputPlaceholder: "Type a message...",
    listening: "Listening...",
    processing: "Processing...",
    serverError: "Server error.",
    micError: "Microphone error",
    backendError: "Backend error.",
    settingsTitle: "Settings",
    langLabel: "Language",
    predefinedLabel: "Quick Profiles",
    advancedLabel: "Advanced Settings",
    inputModelLabel: "Input Model (STT)",
    voiceModelLabel: "Voice Model (TTS)",
    whisperWarning:
      "Whisper increases response time and requires you to press a button when you finish speaking (it doesn't work automatically)",
    webDesc: "Fast, no emotions",
    whisperDesc: "Slower, more accurate",
    featuresLabel: "Features",
    enableEmotions: "Emotion Detection",
    enableTTS: "Read Messages (TTS)",
    recordingStart:
      "When you finish speaking press the red button at the bottom",
    profileFast: "Fast ⚡",
    profileFastDesc: "Browser • No Emotions",
    profileEmp: "Empathetic ❤️",
    profileEmpDesc: "Whisper AI • Emotions",
    copyright: "Mateusz Staszków. All rights reserved.",
  },
};

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// --- KOMPONENT: Animacja Fali ---
const SoundWave: React.FC = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="flex items-center justify-between w-[80%] h-full">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-blue-500 rounded-full animate-wave"
          style={{
            height: "10%",
            animation: "wave 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.05}s`,
          }}
        ></div>
      ))}
    </div>
    <style>{`
      @keyframes wave {
        0%, 100% { height: 10%; opacity: 0.4; }
        50% { height: 60%; opacity: 1; }
      }
    `}</style>
  </div>
);

const App: React.FC = () => {
  // --- STATE ---
  const [state, setState] = useState<AppState>({
    isRecording: false,
    isProcessing: false,
    transcript: "",
    messages: [],
    error: null,
    showSettings: false,
    settings: {
      language: "en",
      sttModel: "browser",
      ttsModel: "browser",
      enableEmotions: false,
      enableTTS: false,
    },
  });
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  // Dodaj ten useEffect, aby załadować głosy po uruchomieniu aplikacji
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();

    // Chrome ładuje głosy asynchronicznie, więc musimy nasłuchiwać zdarzenia
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  const [inputText, setInputText] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const t = TRANSLATIONS[state.settings.language]; // Skrót do tłumaczeń

  // --- REFS ---
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Funkcja sprawdzająca "zdrowie" serwera
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch("http://localhost:5000/health");
        if (res.ok) {
          setIsBackendConnected(true);
        } else {
          setIsBackendConnected(false);
        }
      } catch (err) {
        setIsBackendConnected(false);
      }
    };

    // Sprawdź od razu po załadowaniu
    checkConnection();

    // Opcjonalnie: Sprawdzaj co 30 sekund (żeby status się zaktualizował jak padnie serwer)
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);
  // Initial Greeting
  useEffect(() => {
    const greeting =
      state.settings.language === "pl"
        ? "Cześć! Gdzie chcesz lecieć?"
        : "Hi! Where do you want to fly?";

    if (state.messages.length === 0 || state.messages[0].id === "init") {
      setState((prev) => ({
        ...prev,
        messages: [
          {
            id: "init",
            role: "assistant",
            text: greeting,
            timestamp: new Date(),
          },
        ],
      }));
    }
  }, [state.settings.language]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.isProcessing, interimTranscript]);

  useEffect(() => {
    // Jeśli użytkownik wyłączył TTS (z true na false)
    if (!state.settings.enableTTS) {
      console.log("TTS wyłączony - przerywam mówienie.");
      window.speechSynthesis.cancel(); // <- To jest ten hamulec ręczny
    }
  }, [state.settings.enableTTS]); // Tablica zależności: uruchom to tylko gdy zmieni się enableTTS

  // --- TTS ---
  const speakText = (text: string) => {
    if (!state.settings.enableTTS) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const isPolish = state.settings.language === "pl";
    const targetLang = isPolish ? "pl-PL" : "en-US";

    utterance.lang = targetLang;

    if (availableVoices.length > 0) {
      // KROK 1: Filtrujemy głosy pasujące do języka
      const langVoices = availableVoices.filter((v) =>
        v.lang.includes(isPolish ? "pl" : "en")
      );

      // KROK 2: Szukamy "najlepszego" głosu (Natural > Google > Systemowy)
      let selectedVoice = langVoices.find(
        (v) => v.name.includes("Natural") || v.name.includes("Online") // Edge Neural (Najlepsze)
      );

      if (!selectedVoice) {
        selectedVoice = langVoices.find((v) => v.name.includes("Google")); // Chrome (Średnie/Dobre)
      }

      if (!selectedVoice) {
        selectedVoice = langVoices[0]; // Pierwszy z brzegu (Systemowy - słaby)
      }

      // Przypisanie
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`Wybrano głos: ${selectedVoice.name}`);
      }
    }

    // Opcjonalnie: Lekkie zwolnienie tempa dla polskiego, żeby brzmiał naturalniej
    if (isPolish) {
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
    }

    window.speechSynthesis.speak(utterance);
  };
  // --- ACTIONS ---
  const handleNewChat = () => {
    const greeting =
      state.settings.language === "pl"
        ? "Cześć! Gdzie chciałbyś się wybrać?"
        : "Hi! Where do you want to go?";
    setState((prev) => ({
      ...prev,
      messages: [
        {
          id: Date.now().toString(),
          role: "assistant",
          text: greeting,
          timestamp: new Date(),
        },
      ],
      error: null,
      transcript: "",
    }));
    setInputText("");
    setInterimTranscript("");
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isProcessing: true,
    }));
    setInputText("");
    setInterimTranscript("");

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: state.settings.language,
        }),
      });

      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.response,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, aiMsg],
        isProcessing: false,
      }));
      speakText(data.response);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: t.serverError,
      }));
    }
  };

  // --- WEB SPEECH API ---
  useEffect(() => {
    const { webkitSpeechRecognition, SpeechRecognition } =
      window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;

    if (Recognition) {
      recognitionRef.current = new Recognition();
      recognitionRef.current.lang =
        state.settings.language === "pl" ? "pl-PL" : "en-US";
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          event.results[i].isFinal
            ? (final += event.results[i][0].transcript)
            : (interim += event.results[i][0].transcript);
        }
        if (final) {
          handleSendMessage(final);
          stopRecording();
        } else {
          setInterimTranscript(interim);
        }
      };

      recognitionRef.current.onerror = () => stopRecording();
      recognitionRef.current.onend = () => {
        if (state.isRecording && state.settings.sttModel === "browser") {
          setState((prev) => ({ ...prev, isRecording: false }));
        }
      };
    }
  }, [state.settings.language, state.settings.sttModel]);

  // --- RECORDING ---
  const startRecording = async () => {
    setState((prev) => ({ ...prev, isRecording: true, error: null }));

    if (state.settings.sttModel === "browser") {
      try {
        recognitionRef.current?.start();
      } catch (e) {}
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioToBackend(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.start();
    } catch (e) {
      setState((prev) => ({ ...prev, isRecording: false, error: t.micError }));
    }
  };

  const stopRecording = () => {
    setState((prev) => ({ ...prev, isRecording: false }));
    setInterimTranscript("");
    state.settings.sttModel === "browser"
      ? recognitionRef.current?.stop()
      : mediaRecorderRef.current?.stop();
  };

  const sendAudioToBackend = async (blob: Blob) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    const formData = new FormData();
    formData.append("audio", blob);
    formData.append("language", state.settings.language);

    try {
      const res = await fetch("http://localhost:5000/process_audio", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        text: data.user_text,
        timestamp: new Date(),
      };

      // LOGIKA EMOCJI: Jeśli wyłączone w ustawieniach, nie pokazujemy ich (chociaż backend je obliczył)
      // Jeśli włączone, możemy je dokleić do stanu lub wykorzystać w UI (tutaj tylko czysty tekst)
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.response,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg, aiMsg],
        isProcessing: false,
      }));
      speakText(data.response);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: t.backendError,
      }));
    }
  };

  // --- SETTINGS HELPERS ---
  const activeProfile = (): "fast" | "empathetic" | "custom" => {
    const { sttModel, ttsModel, enableEmotions, enableTTS } = state.settings;
    if (
      sttModel === "browser" &&
      ttsModel === "browser" &&
      !enableEmotions &&
      !enableTTS
    )
      return "fast";
    // Profil Empathetic: Whisper + Emocje ON
    if (sttModel === "whisper" && ttsModel === "browser" && enableEmotions)
      return "empathetic";
    return "custom";
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white shadow-2xl relative overflow-hidden">
      {" "}
      {/* --- HEADER --- */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 20px;
        }
      `}</style>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
            <i className="fas fa-plane-departure text-xl"></i>
          </div>
          <div>
            {/* Tytuł: powrót do text-lg */}
            <h1 className="font-bold text-gray-800 text-lg">{t.title}</h1>

            {/* Status Zmienny */}
            <p
              className={`text-xs font-medium flex items-center gap-1 ${
                isBackendConnected ? "text-green-500" : "text-red-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBackendConnected
                    ? "bg-green-500 animate-pulse"
                    : "bg-red-500"
                }`}
              ></span>
              {isBackendConnected ? t.available : t.unavailable}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Toggles (Visible outside settings) */}
          <button
            onClick={() =>
              setState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enableTTS: !prev.settings.enableTTS,
                },
              }))
            }
            className={`rounded-full flex items-center justify-center transition-all ${
              state.settings.enableTTS
                ? "w-11 h-11 bg-green-100 text-green-600"
                : "w-9 h-9 bg-transparent text-gray-300 hover:text-gray-400"
            }`}
            title={t.enableTTS}
          >
            <i
              className={`fas text-lg ${
                state.settings.enableTTS ? "fa-volume-high" : "fa-volume-xmark"
              }`}
            ></i>
          </button>

          <button
            onClick={() =>
              setState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enableEmotions: !prev.settings.enableEmotions,
                  sttModel: !prev.settings.enableEmotions
                    ? "whisper"
                    : "browser",
                },
              }))
            }
            className={`rounded-full flex items-center justify-center transition-all ${
              state.settings.enableEmotions
                ? "w-11 h-11 bg-purple-100 text-purple-600"
                : "w-9 h-9 bg-transparent text-gray-300 hover:text-gray-400"
            }`}
            title={t.enableEmotions}
          >
            <i
              className={`fas text-lg ${
                state.settings.enableEmotions ? "fa-face-smile" : "fa-face-meh"
              }`}
            ></i>
          </button>

          {/* Divider */}
          <div className="h-5 border-l border-gray-200"></div>

          {/* New Chat (Clean Icon) */}
          <button
            onClick={handleNewChat}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
            title="Nowy Czat"
          >
            <i className="fas fa-plus text-xl"></i>
          </button>

          {/* Settings */}
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, showSettings: true }))
            }
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            title={t.settingsTitle}
          >
            <i className="fas fa-cog text-xl"></i>
          </button>
        </div>
      </header>
      {/* --- CHAT --- */}
      <main className="flex-1 overflow-y-auto p-6 space-y-2 bg-gray-50/50">
        {state.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {state.isRecording && state.settings.sttModel !== "browser" && (
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-500 rounded-tr-none border border-gray-200 opacity-80 italic">
              <p className="text-sm">{t.recordingStart}</p>
            </div>
          </div>
        )}

        {interimTranscript && (
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-500 rounded-tr-none border border-gray-200 opacity-80 italic">
              <p className="text-sm">{interimTranscript}...</p>
            </div>
          </div>
        )}

        {state.isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>
      {/* --- FOOTER --- */}
      <footer className="p-4 bg-white border-t">
        {state.error && (
          <div className="text-red-500 text-xs mb-2 text-center">
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={state.isRecording ? stopRecording : startRecording}
            className={`
              h-14 w-14 rounded-full flex-shrink-0 flex items-center justify-center transition-all shadow-md
              ${
                state.isRecording
                  ? "bg-red-500 shadow-red-200 animate-pulse"
                  : state.settings.enableEmotions
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }
            `}
          >
            <i
              className={`fas ${
                state.isRecording
                  ? state.settings.sttModel !== "browser"
                    ? "fa-paper-plane text-xl"
                    : "fa-stop"
                  : "fa-microphone text-xl"
              }`}
            ></i>
          </button>

          <div className="flex-1 h-14 bg-gray-100 rounded-full px-5 flex items-center transition-all relative overflow-hidden">
            {state.isRecording ? (
              <SoundWave />
            ) : (
              <>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(inputText);
                    }
                  }}
                  placeholder={t.inputPlaceholder}
                  className="bg-transparent w-full h-full outline-none text-gray-700 placeholder-gray-400 text-sm resize-none py-4 pr-3 overflow-y-auto custom-scrollbar"
                />
                <button
                  onClick={() => handleSendMessage(inputText)}
                  className="text-blue-600 hover:text-blue-800 ml-2"
                >
                  <i className="fas fa-paper-plane text-xl"></i>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-[10px] text-gray-300 text-center font-medium">
          &copy; {new Date().getFullYear()} {t.copyright}
        </div>
      </footer>
      {/* --- SETTINGS MODAL --- */}
      {state.showSettings && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {t.settingsTitle}
              </h2>
              <button
                onClick={() =>
                  setState((prev) => ({ ...prev, showSettings: false }))
                }
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-6">
              {/* Język */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t.langLabel}
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, language: "en" },
                      }))
                    }
                    className={`flex-1 py-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                      state.settings.language === "en"
                        ? "border-blue-500 bg-blue-50"
                        : "border-transparent bg-gray-50 opacity-60"
                    }`}
                  >
                    <span
                      className="fi fi-us"
                      style={{ fontSize: "1.7rem", borderRadius: "0.375rem" }}
                    ></span>
                    <span className="text-xs font-medium text-gray-700">
                      English
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, language: "pl" },
                      }))
                    }
                    className={`flex-1 py-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                      state.settings.language === "pl"
                        ? "border-blue-500 bg-blue-50"
                        : "border-transparent bg-gray-50 opacity-60"
                    }`}
                  >
                    <span
                      className="fi fi-pl"
                      style={{ fontSize: "1.7rem", borderRadius: "0.375rem" }}
                    ></span>
                    <span className="text-xs font-medium text-gray-700">
                      Polish
                    </span>
                  </button>
                </div>
              </div>

              {/* Profile */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t.predefinedLabel}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          sttModel: "browser",
                          ttsModel: "browser",
                          enableEmotions: false,
                          enableTTS: false,
                        },
                      }))
                    }
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      activeProfile() === "fast"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="font-bold text-gray-800 text-sm mb-1">
                      {t.profileFast}
                    </div>
                    <div className="text-[10px] text-gray-500 leading-tight">
                      {t.profileFastDesc}
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          sttModel: "whisper",
                          ttsModel: "browser",
                          enableEmotions: true,
                          enableTTS: true,
                        },
                      }))
                    }
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      activeProfile() === "empathetic"
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="font-bold text-gray-800 text-sm mb-1">
                      {t.profileEmp}
                    </div>
                    <div className="text-[10px] text-gray-500 leading-tight">
                      {t.profileEmpDesc}
                    </div>
                  </button>
                </div>
              </div>

              {/* Advanced */}
              <div className="border-t pt-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {t.advancedLabel}
                </div>

                {/* Feature Toggles */}
                <div className="mb-4 border border-gray-200 rounded-2xl bg-white">
                  <label className="flex items-center justify-between px-3 py-2 rounded-t-2xl cursor-pointer hover:bg-gray-50 gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      {t.enableTTS}
                    </span>
                    <span
                      className={`w-5 h-5 flex items-center justify-center rounded-full border transition-colors ${
                        state.settings.enableTTS
                          ? "bg-green-500 border-green-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={`w-3.5 h-3.5 ${
                          state.settings.enableTTS
                            ? "text-white"
                            : "text-transparent"
                        }`}
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M4 8.5L7 11.5L12 5.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <input
                      type="checkbox"
                      checked={state.settings.enableTTS}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            enableTTS: e.target.checked,
                          },
                        }))
                      }
                      className="sr-only"
                    />
                  </label>

                  <div className="border-t border-gray-200" />

                  <label
                    className={`flex items-center justify-between px-3 py-2 rounded-b-2xl cursor-pointer hover:bg-gray-50 gap-3 ${
                      state.settings.sttModel === "browser" ? "opacity-50" : ""
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-700 block">
                        {t.enableEmotions}
                      </span>
                      {state.settings.sttModel === "browser" && (
                        <span className="text-[9px] text-red-500 block">
                          Wymaga modelu Whisper
                        </span>
                      )}
                    </div>
                    <span
                      className={`w-5 h-5 flex items-center justify-center rounded-full border transition-colors ${
                        state.settings.enableEmotions
                          ? "bg-purple-600 border-purple-600"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={`w-3.5 h-3.5 ${
                          state.settings.enableEmotions
                            ? "text-white"
                            : "text-transparent"
                        }`}
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M4 8.5L7 11.5L12 5.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <input
                      type="checkbox"
                      checked={state.settings.enableEmotions}
                      disabled={state.settings.sttModel === "browser"}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            enableEmotions: e.target.checked,
                          },
                        }))
                      }
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* STT Select */}
                <div className="mb-3">
                  <label className="text-[13px] text-gray-500 font-semibold mb-1 block">
                    {t.inputModelLabel}
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-lg min-h-[44px]">
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            sttModel: "browser",
                            enableEmotions: false,
                          },
                        }))
                      } // Browser wymusza brak emocji
                      className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                        state.settings.sttModel === "browser"
                          ? "bg-white shadow text-blue-500"
                          : "text-gray-500"
                      }`}
                    >
                      Web (Fast)
                    </button>
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, sttModel: "whisper" },
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                        state.settings.sttModel === "whisper"
                          ? "bg-white shadow text-purple-600"
                          : "text-gray-500"
                      }`}
                    >
                      Whisper (Slow)
                    </button>
                  </div>
                  {state.settings.sttModel === "whisper" && (
                    <p className="text-[10px] text-orange-500 mt-1 ml-1">
                      {t.whisperWarning}
                    </p>
                  )}
                </div>

                {/* TTS Select */}
                <div>
                  <label className="text-[13px] text-gray-500 font-semibold mb-1 block">
                    {t.voiceModelLabel}
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-lg min-h-[44px]">
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, ttsModel: "browser" },
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                        state.settings.ttsModel === "browser"
                          ? "bg-white shadow text-blue-500"
                          : "text-gray-500"
                      }`}
                    >
                      Web (Fast)
                    </button>
                    <button
                      disabled
                      className="flex-1 py-1.5 rounded-md text-xs font-medium text-gray-300 cursor-not-allowed"
                    >
                      Piper
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
