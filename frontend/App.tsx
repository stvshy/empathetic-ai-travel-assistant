import React, { useState, useEffect, useRef } from "react";
import { Message, AppState, Settings } from "./types";
import ChatBubble from "./components/ChatBubble";

// --- LEPSZE WYKRYWANIE URZĄDZENIA ---
const getIsMobile = () => {
  if (typeof window === "undefined") return false;
  // Sprawdza User Agent ORAZ czy urządzenie obsługuje dotyk
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
  );
};
const isMobile = getIsMobile();
// --- SŁOWNIK TŁUMACZEŃ ---
const TRANSLATIONS = {
  pl: {
    title: "Asystent Podróży",
    available: "Dostępny",
    unavailable: "Niedostępny",
    inputPlaceholder: "Napisz wiadomość...",
    listening: "Słucham...",
    mobileListeningHint: "Słucham... (przestań mówić, aby wysłać)", 
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
    piperWarning:
      "Piper wymaga przetworzenia na serwerze – głos asystenta usłyszysz ze znacznym opóźnieniem.",
    webDesc: "Szybki, brak emocji",
    whisperDesc: "Wolniejszy, dokładniejszy",
    featuresLabel: "Funkcje",
    enableEmotions: "Wykrywanie Emocji",
    enableTTS: "Czytanie Wiadomości (TTS)",
    recordingStart: "Jeśli skończysz mówić wciśnij czerwony przycisk na dole",
    newChat: "Nowy Czat",
    modelWeb: "Web (Szybki)",
    modelPiper: "Piper (Wolny)",
    modelWhisper: "Whisper (Wolny)",
    whisperReq: "Wymaga modelu Whisper",
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
    mobileListeningHint: "Listening... (pause to send)",
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
    piperWarning:
      "Piper requires processing on the server – you will hear the assistant's voice with a significant delay.",
    webDesc: "Fast, no emotions",
    whisperDesc: "Slower, more accurate",
    featuresLabel: "Features",
    enableEmotions: "Emotion Detection",
    enableTTS: "Read Messages (TTS)",
    recordingStart:
      "When you finish speaking press the red button at the bottom",
    newChat: "New Chat",
    modelWeb: "Web (Fast)",
    modelPiper: "Piper (Slow)",
    modelWhisper: "Whisper (Slow)",
    whisperReq: "Requires Whisper model",
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
  // --- KONFIGURACJA ADRESU API ---
    const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

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

  // Ref do przechowywania aktualnych ustawień 
  const settingsRef = useRef(state.settings);

  // Aktualizacja refa przy każdej zmianie state.settings
  useEffect(() => {
    settingsRef.current = state.settings;
  }, [state.settings]);

  // Ref do śledzenia aktualnych messages 
  const messagesRef = useRef(state.messages);

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Aktualizacja refa przy każdej zmianie state.messages
  useEffect(() => {
    messagesRef.current = state.messages;
    console.log("📝 messages zaktualizowane:", state.messages.length);
  }, [state.messages]);

  // Ładowanie dostępnych głosów TTS
  useEffect(() => {
    // ZABEZPIECZENIE: Sprawdzamy czy API istnieje
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          const voices = window.speechSynthesis.getVoices();
          setAvailableVoices(voices);
        } catch (e) {
          console.warn("Błąd ładowania głosów:", e);
        }
      };
      
      loadVoices();
      
      // Niektóre przeglądarki mobilne nie mają tego zdarzenia
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      return () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);
  const [inputText, setInputText] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const t = TRANSLATIONS[state.settings.language]; // Skrót do tłumaczeń

  // --- REFS ---
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Flaga zapobiegająca podwójnemu wysłaniu tej samej wypowiedzi
  const isProcessingSpeechRef = useRef(false);
  // Ref do śledzenia czy greeting został już ustawiony
  const greetingInitializedRef = useRef(false);
  const previousLanguageRef = useRef(state.settings.language);
  // Ref do aktualnie odtwarzanego audio z Pipera
  const piperAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Funkcja sprawdzająca "zdrowie" serwera
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
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
  // Initial Greeting + Reset historii TYLKO gdy zmieni się język
  useEffect(() => {
    const greeting =
      state.settings.language === "pl"
        ? "Cześć! Gdzie chcesz się wybrać?"
        : "Hi! Where do you want to go?";

    // Jeśli to pierwszy raz - ustaw greeting
    if (!greetingInitializedRef.current) {
      greetingInitializedRef.current = true;
      previousLanguageRef.current = state.settings.language;
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
      return;
    }

    // Jeśli język się zmienił - resetuj historię I greeting
    if (previousLanguageRef.current !== state.settings.language) {
      previousLanguageRef.current = state.settings.language;
      console.log("🌍 Zmieniono język - resetuję czat");
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
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // <- To jest ten hamulec ręczny
      }
      // Przerwij też Pipera
      if (piperAudioRef.current) {
        piperAudioRef.current.pause();
        piperAudioRef.current.currentTime = 0;
        piperAudioRef.current = null;
      }
    }
  }, [state.settings.enableTTS]); // Tablica zależności: uruchom to tylko gdy zmieni się enableTTS

  // Zmiana języka powinna natychmiast zatrzymać aktualne czytanie
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Przerwij też Pipera
    if (piperAudioRef.current) {
      piperAudioRef.current.pause();
      piperAudioRef.current.currentTime = 0;
      piperAudioRef.current = null;
    }
  }, [state.settings.language]);

  // --- FUNKCJA CZYSZCZĄCA MARKDOWN ---
  const stripMarkdown = (text: string): string => {
    return text
      // Usuń nagłówki (##, ###, etc.)
      .replace(/^#{1,6}\s+/gm, '')
      // Usuń pogrubienie i kursywę (**tekst**, *tekst*)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      // Usuń linki [text](url)
      .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
      // Usuń bloki kodu ```
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.+?)`/g, '$1')
      // Usuń listy punktowane (-, *, +)
      .replace(/^[\s]*[-\*\+]\s+/gm, '')
      // Usuń listy numerowane
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Usuń nadmiarowe białe znaki
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // --- TTS ---
  const speakText = async (text: string) => {
    // Sprawdzamy ustawienia z Refa, a nie ze stanu (który może być nieaktualny w closure)
    if (!settingsRef.current.enableTTS) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Zatrzymaj poprzednie audio z Pipera jeśli jest
    if (piperAudioRef.current) {
      piperAudioRef.current.pause();
      piperAudioRef.current = null;
    }

    // Wyczyść markdown przed wysłaniem do TTS
    const cleanText = stripMarkdown(text);

    // Jeśli wybrano Pipera, używamy backendu
    if (settingsRef.current.ttsModel === "piper") {
      try {
        const res = await fetch(`${API_URL}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
        });

        if (!res.ok) {
          console.error("Piper TTS error:", await res.text());
          return;
        }

        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Zapisz referencję do audio
        piperAudioRef.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          piperAudioRef.current = null;
        };
        await audio.play();
      } catch (err) {
        console.error("Piper TTS failed:", err);
      }
      return;
    }

    // Używamy przeglądarki (oryginalny kod)
    if ('SpeechSynthesisUtterance' in window && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      // Używamy języka z Refa dla pewności
      const isPolish = settingsRef.current.language === "pl";
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
    }
  };
  // --- ACTIONS ---
  const handleNewChat = () => {
    // Nowy czat przerywa ewentualne mówienie
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Przerwij też Pipera
    if (piperAudioRef.current) {
      piperAudioRef.current.pause();
      piperAudioRef.current.currentTime = 0;
      piperAudioRef.current = null;
    }
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
    if (silenceTimerRef.current) {
     clearTimeout(silenceTimerRef.current);
     silenceTimerRef.current = null;
  }
    if (!text.trim()) return;
    // Przerwij czytanie natychmiast po wysłaniu wiadomości
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Przerwij też Pipera
    if (piperAudioRef.current) {
      piperAudioRef.current.pause();
      piperAudioRef.current.currentTime = 0;
      piperAudioRef.current = null;
    }
    
    console.log("🔍 DEBUG handleSendMessage - state.messages:", state.messages);
    console.log("🔍 DEBUG handleSendMessage - messagesRef.current:", messagesRef.current);
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    
    // PRZYGOTOWANIE HISTORII PRZED wysłaniem 
    // Filtrujemy wiadomość powitalną (init) i obecne wiadomości użytkownika
    const historyBeforeUserMsg = messagesRef.current
      .filter(msg => msg.id !== "init")
      .map(msg => ({
        role: msg.role,
        text: msg.text
      }));

    console.log("📤 Wysyłam historię do backendu (przed nową wiadomością):", historyBeforeUserMsg.length, "wiadomości");
    console.log("Historia:", historyBeforeUserMsg);
    
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isProcessing: true,
    }));
    setInputText("");
    setInterimTranscript("");

    try {
      console.log("📨 Przygotowuję request do /chat");
      console.log("Payload:", {
        text,
        language: state.settings.language,
        history: historyBeforeUserMsg,
      });

      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: state.settings.language,
          history: historyBeforeUserMsg, 
        }),
      });

      console.log("✅ Odpowiedź z backendu:", res.status);

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
      const recognition = new Recognition();
      recognition.lang = state.settings.language === "pl" ? "pl-PL" : "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let final = "";
        let interim = "";
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          // DEBUG: Sprawdź w konsoli co wykrył
          console.log(`🎤 Final text: "${final}". Tryb Mobile?: ${isMobile}`);

          if (isMobile) {
            // --- TRYB MOBILNY (CZEKA NA CISZĘ) ---
            setInputText((prev) => {
              const newText = prev ? `${prev} ${final}` : final;
              
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              
              silenceTimerRef.current = setTimeout(() => {
                if (!isProcessingSpeechRef.current) {
                   console.log("⏳ Timer ciszy minął - wysyłam (Mobile)");
                   isProcessingSpeechRef.current = true;
                   handleSendMessage(newText); 
                   stopRecording();
                }
              }, 2000); // 2 sekundy czekania
              
              return newText;
            });
          } else {
            // --- TRYB KOMPUTEROWY (NATYCHMIAST) ---
            console.log("🚀 Tryb PC - wysyłam natychmiast");
            if (!isProcessingSpeechRef.current) {
              isProcessingSpeechRef.current = true;
              handleSendMessage(final);
              stopRecording();
            }
          }
        } else {
          setInterimTranscript(interim);
          // Reset timera jeśli słyszy "szum" (interim)
           if (isMobile && silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
           }
        }
      };

      recognition.onerror = () => stopRecording();
      
      recognition.onend = () => {
        // Na PC kończymy od razu. Na Mobile ignorujemy onend, bo timer zarządza wysyłką.
        if (state.isRecording && state.settings.sttModel === "browser" && !isMobile) {
           setState((prev) => ({ ...prev, isRecording: false }));
        }
      };

      recognitionRef.current = recognition;
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.abort(); 
          recognitionRef.current = null;
        }
      };
    }
  }, [state.settings.language, state.settings.sttModel]);

  // --- RECORDING ---
   const startRecording = async () => {
    // Przerwij czytanie, gdy użytkownik zaczyna mówić
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Przerwij też Pipera
    if (piperAudioRef.current) {
      piperAudioRef.current.pause();
      piperAudioRef.current.currentTime = 0;
      piperAudioRef.current = null;
    }
    
    // Reset flagi blokującej podwójne wiadomości
    isProcessingSpeechRef.current = false;

    setState((prev) => ({ ...prev, isRecording: true, error: null }));
    if (state.settings.sttModel === "browser") {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("STT Error:", e);
      }
      return;
    }
    
    // Logika Whispera
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
  if (silenceTimerRef.current) {
     clearTimeout(silenceTimerRef.current);
     silenceTimerRef.current = null;
  }
  // Jeśli jest jakiś tekst w polu na mobile i klikniesz stop -> wyślij go
  if (isMobile && inputText.trim() && state.settings.sttModel === "browser") {
      if (!isProcessingSpeechRef.current) {
          isProcessingSpeechRef.current = true;
          handleSendMessage(inputText);
      }
  }
    setState((prev) => ({ ...prev, isRecording: false }));
    setInterimTranscript("");
    state.settings.sttModel === "browser"
      ? recognitionRef.current?.stop()
      : mediaRecorderRef.current?.stop();
  };

   const sendAudioToBackend = async (blob: Blob) => {
    // Filtrujemy wiadomość powitalną (init)
    const history = messagesRef.current
      .filter(msg => msg.id !== "init") // Wyłącz greeting
      .map(msg => ({
        role: msg.role,
        text: msg.text
      }));
    
    console.log("📤 Wysyłam historię (audio) do backendu:", history.length, "wiadomości");
    console.log("Historia:", history);
    
    setState((prev) => ({ ...prev, isProcessing: true }));
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const formData = new FormData();
    formData.append("audio", blob);
    formData.append("language", state.settings.language);
    formData.append("history", JSON.stringify(history)); 

     try {
      const res = await fetch(`${API_URL}/process_audio`, {
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
<div className="flex flex-col h-full w-full absolute inset-0 sm:static sm:h-full sm:max-w-2xl sm:mx-auto bg-white sm:shadow-2xl overflow-hidden"
style={{ paddingTop: 'env(safe-area-inset-top)' }}>      {" "}
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
      <header className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-blue-100 p-1.5 sm:p-2 rounded-xl text-blue-600 flex-shrink-0">
            <i className="fas fa-plane-departure text-base sm:text-xl"></i>
          </div>
          <div className="min-w-0">
            {/* Tytuł: responsive */}
            {/* <h1 className="font-bold text-gray-800 text-base sm:text-lg truncate">{t.title}</h1> */}

            {/* odtąd usunąć i powyższe odkomentować*/}
            <h1 className="font-bold text-gray-800 text-base sm:text-lg truncate">{t.title}</h1>
            
            {/* --- DEBUGGER URZĄDZENIA (Usuń po testach) --- */}
            <span className="text-[10px] uppercase font-bold text-gray-400 border border-gray-200 px-1 rounded">
              {isMobile ? "TRYB: TELEFON" : "TRYB: PC"}
            </span>
            {/* dotąd usunąć*/}

            {/* Status Zmienny */}
            <p
              className={`text-xs font-medium flex items-center gap-1 ${
                isBackendConnected ? "text-green-500" : "text-red-500"
              } truncate`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isBackendConnected
                    ? "bg-green-500 animate-pulse"
                    : "bg-red-500"
                }`}
              ></span>
              <span className="truncate">{isBackendConnected ? t.available : t.unavailable}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Quick Toggles (Visible outside settings) */}
          <button
            onClick={() => {
              if (state.settings.enableTTS && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              
              setState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enableTTS: !prev.settings.enableTTS,
                },
              }));
            }}
            className={`rounded-full flex items-center justify-center transition-all text-base sm:text-lg ${
              state.settings.enableTTS
                ? "w-9 h-9 sm:w-11 sm:h-11 bg-green-100 text-green-600"
                : "w-9 h-9 bg-transparent text-gray-300 hover:text-gray-400"
            }`}
            title={t.enableTTS}
          >
            <i
              className={`fas ${
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
            className={`rounded-full flex items-center justify-center transition-all text-base sm:text-lg ${
              state.settings.enableEmotions
                ? "w-9 h-9 sm:w-11 sm:h-11 bg-purple-100 text-purple-600"
                : "w-9 h-9 bg-transparent text-gray-300 hover:text-gray-400"
            }`}
            title={t.enableEmotions}
          >
            <i
              className={`fas ${
                state.settings.enableEmotions ? "fa-face-smile" : "fa-face-meh"
              }`}
            ></i>
          </button>

          {/* Divider */}
          <div className="h-5 border-l border-gray-200"></div>

          {/* New Chat (Clean Icon) */}
          <button
            onClick={handleNewChat}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors text-base sm:text-xl"
            title={t.newChat}
          >
            <i className="fas fa-plus"></i>
          </button>

          {/* Settings */}
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, showSettings: true }))
            }
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-base sm:text-xl"
            title={t.settingsTitle}
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>
      {/* --- CHAT --- */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-2 bg-gray-50/50">
        {state.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {state.isRecording && state.settings.sttModel === "browser" && isMobile && (
           <div className="flex justify-center mb-2 animate-pulse">
              <p className="text-xs text-gray-500 italic bg-white/80 px-3 py-1 rounded-full shadow-sm">
                 {t.mobileListeningHint}
              </p>
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
      <footer className="p-3 sm:p-4 bg-white border-t">
        {state.error && (
          <div className="text-red-500 text-xs mb-2 text-center">
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={state.isRecording ? stopRecording : startRecording}
            className={`
              h-12 sm:h-14 w-12 sm:w-14 rounded-full flex-shrink-0 flex items-center justify-center transition-all shadow-md
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
                    ? "fa-paper-plane text-lg sm:text-xl"
                    : "fa-stop"
                  : "fa-microphone text-lg sm:text-xl"
              }`}
            ></i>
          </button>

          <div className="flex-1 h-12 sm:h-14 bg-gray-100 rounded-full px-4 sm:px-5 flex items-center transition-all relative overflow-hidden">
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
                  className="bg-transparent w-full h-full outline-none text-gray-700 placeholder-gray-400 text-sm resize-none py-3 sm:py-4 pr-3 overflow-y-auto custom-scrollbar"
                />
                <button
                  onClick={() => handleSendMessage(inputText)}
                  className="text-blue-600 hover:text-blue-800 ml-2 flex-shrink-0"
                >
                  <i className="fas fa-paper-plane text-lg sm:text-xl"></i>
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
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-3xl p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] mx-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
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
                      onChange={(e) => {
                        const newVal = e.target.checked;
                        if (!newVal && 'speechSynthesis' in window) window.speechSynthesis.cancel(); // FIX: Stop immediate
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            enableTTS: newVal,
                          },
                        }));
                      }}
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
                          {t.whisperReq}
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
                      {t.modelWeb}
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
                      {t.modelWhisper}
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
                      {t.modelWeb}
                    </button>
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, ttsModel: "piper" },
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                        state.settings.ttsModel === "piper"
                          ? "bg-white shadow text-purple-600"
                          : "text-gray-500"
                      }`}
                    >
                      {t.modelPiper}
                    </button>
                  </div>
                  {state.settings.ttsModel === "piper" && (
                    <p className="text-[10px] text-orange-500 mt-1 ml-1">
                      {t.piperWarning}
                    </p>
                  )}
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
