import React, { useState, useEffect, useRef } from "react";
import { Message, AppState, Settings } from "./types";
import ChatBubble from "./components/ChatBubble";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hyphenateHTMLSync as hyphenatePl } from 'hyphen/pl';
import { hyphenateHTMLSync as hyphenateEn } from 'hyphen/en';

// --- WYKRYWANIE URZĄDZENIA ---
const getIsMobile = () => {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  // Sprawdzamy konkretnie systemy mobilne, ignorując laptopy z dotykiem
  return /android|ipad|iphone|ipod/i.test(userAgent);
};
const isMobile = getIsMobile();

// --- SPRAWDZANIE OBSŁUGI WEB SPEECH API ---
const checkWebSpeechSupport = () => {
  if (typeof window === "undefined") return { stt: false, tts: false };

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isOpera = /\bOPR\//i.test(ua) || /\bOpera\b/i.test(ua);
  const isProbablyMobile = /android|ipad|iphone|ipod/i.test(ua);
  const isOperaDesktop = isOpera && !isProbablyMobile;

  const host = window.location?.hostname || "";
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  const isSecureOrLocal = !!(window.isSecureContext || isLocalhost);
  const hasGetUserMedia = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function");
  
  // Sprawdzenie Web Speech Recognition (STT) - rzeczywisty test instancjonowania
  let sttWorking = false;
  try {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Opera (desktop) często wystawia obiekt, ale STT realnie nie działa.
    if (SpeechRecognition && !isOperaDesktop && isSecureOrLocal && hasGetUserMedia) {
      const temp = new SpeechRecognition();
      const hasStart = typeof (temp as any).start === "function";
      const hasStopOrAbort = typeof (temp as any).stop === "function" || typeof (temp as any).abort === "function";

      if (hasStart && hasStopOrAbort) {
        // Nie wywołujemy start() (wymaga user-gesture i permission), tylko sprawdzamy realne metody.
        if (typeof (temp as any).abort === "function") (temp as any).abort();
        sttWorking = true;
      }
    }
  } catch (e) {
    console.warn("⚠️ Web Speech Recognition niedostępny:", e);
    sttWorking = false;
  }
  
  // Sprawdzenie Web Speech Synthesis (TTS) - rzeczywisty test instancjonowania
  let ttsWorking = false;
  try {
    if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      const temp = new SpeechSynthesisUtterance("");
      // Jeśli możemy utworzyć utterance, API jest dostępne
      ttsWorking = true;
    }
  } catch (e) {
    console.warn("⚠️ Web Speech Synthesis niedostępny:", e);
    ttsWorking = false;
  }
  
  return { stt: sttWorking, tts: ttsWorking };
};

const webSpeechSupport = checkWebSpeechSupport();

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
    apiDailyLimitError:
      "Przekroczono dzienny limit API chata przez innych użytkowników. Spróbuj [wersji lokalnej](https://github.com/stvshy/empathetic-ai-travel-assistant) lub wróć jutro.",
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
    edgeWarning: "Najwyższa jakość, optymalny czas odpowiedzi",
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
    modelEdge: "Edge (Najlepszy)",
    whisperReq: "Wymaga modelu Whisper",
    profileFast: "Szybki ⚡",
    profileFastDesc: "Bez Emocji",
    profileNormal: "Normalny 👍",
    profileNormalDesc: "Bez Emocji",
    profileEmp: "Empatyczny ❤️",
    profileEmpDesc: "Wykrywa Emocje",
    tapToPlayTTS: "Kliknij, aby odsłuchać odpowiedź",
    copyright: "Mateusz Staszków. Wszelkie prawa zastrzeżone.",
    webSttNotSupported: "ℹ️ Web Speech Recognition nie jest obsługiwany w tej przeglądarce",
    webTtsNotSupported: "ℹ️ Web Speech Synthesis nie jest obsługiwany w tej przeglądarce",
    helpQuickProfiles:
      "**Szybki:** **Web STT** + **Web TTS**. Web TTS jest **najszybszym** modelem głosu, ale jego jakość zależy od przeglądarki. Różnicę zauważysz głównie przy **odczytywaniu odpowiedzi LLM przez TTS**. Czas odpowiedzi tekstowej pozostaje taki sam jak w trybie Normalnym. Model **nie wykrywa emocji** użytkownika podczas mówienia — wykrywa tylko słowa i odpowiada na ich podstawie.\n\n**Normalny:** **Edge TTS** + **Web STT**. Najlepszy **kompromis między jakością a szybkością** odpowiedzi LLM czytanej przez TTS. Model **nie wykrywa emocji** użytkownika podczas mówienia — wykrywa tylko słowa i odpowiada na ich podstawie.\n\n**Empatyczny:** **Whisper STT** + **Edge TTS**. Whisper jest **wymagany do wykrywania emocji**, ale **wydłuża czas odpowiedzi** i wymaga **ręcznego wciśnięcia przycisku** po skończeniu mówienia (nie działa automatycznie). Model **wykrywa emocje** i przekazuje je do LLM, a LLM **dopasowuje styl odpowiedzi** do wykrytych emocji użytkownika.",
    helpAdvanced:
      "**Czytanie Wiadomości (TTS):** Włącza/wyłącza **odczytywanie odpowiedzi asystenta głosem**.\n\n**Wykrywanie Emocji:** Wymaga **Whisper**. Gdy aktywne, aplikacja **analizuje emocje** w głosie użytkownika i przekazuje je do LLM.",
    helpInputModel:
      "**Web (Szybki):** **Najszybsze** rozpoznawanie mowy w przeglądarce, **bez wykrywania emocji**.\n\n**Whisper (Wolny):** Wymagany do **wykrywania emocji**, ale **wolniejszy** (długi czas odpowiedzi) i wymaga **ręcznego zatrzymania**. Niezalecany do normalnego użytku.",
    helpVoiceModel:
      "**Web:** **Najszybszy** odczyt głosu, jakość zależna od przeglądarki i urządzenia. **Ważne:** W przeglądarkach takich jak **Opera**, poprawne czytanie po polsku wymaga zainstalowania **pakietu mowy języka polskiego** w ustawieniach systemu (analogicznie dla języka angielskiego - wersja US).\n\n**Edge:** **Najlepsza jakość** z dobrym czasem odpowiedzi.\n\n**Piper:** Ma **największe opóźnienie**, nie zalecany do normalnego użytku, traktuj go raczej jako alternatywę.",
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
    apiDailyLimitError:
      "The chat API daily limit has been exceeded by other users. Try the [local version](https://github.com/stvshy/empathetic-ai-travel-assistant) or come back tomorrow.",
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
    edgeWarning: "Highest quality, optimal response time",
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
    modelEdge: "Edge (Best)",
    whisperReq: "Requires Whisper model",
    profileFast: "Fast ⚡",
    profileFastDesc: "No Emotions",
    profileNormal: "Normal 👍",
    profileNormalDesc: "No Emotions",
    profileEmp: "Empathetic ❤️",
    profileEmpDesc: "Detects Emotions",
    tapToPlayTTS: "Tap to play the assistant reply",
    copyright: "Mateusz Staszków. All rights reserved.",
    webSttNotSupported: "ℹ️ Web Speech Recognition is not supported in this browser",
    webTtsNotSupported: "ℹ️ Web Speech Synthesis is not supported in this browser",
    helpQuickProfiles:
      "**Fast:** **Web STT** + **Web TTS**. Web TTS is the **fastest** voice model, but its quality depends on your browser. You will mainly notice a difference when **LLM replies are read aloud by TTS**. The text response time stays the same as in Normal mode. The model **does not detect emotions** — it only detects spoken words and responds to them.\n\n**Normal:** **Edge TTS** + **Web STT**. The best **compromise between quality and speed** of LLM feedback read by TTS. The model **does not detect emotions** — it only detects spoken words and responds to them.\n\n**Empathetic:** **Whisper STT** + **Edge TTS**. Whisper is **required for emotion detection**, but it **increases response time** and requires **pressing a button** when you finish speaking (it does not work automatically). The model **detects emotions** and sends them to the LLM, and the LLM **adjusts the response style** to the detected user emotions.",
    helpAdvanced:
      "**Read Messages (TTS):** Turns **voice playback** of assistant responses on/off.\n\n**Emotion Detection:** Requires **Whisper**. When enabled, the app **analyzes emotions** in the user's voice and passes them to the LLM.",
    helpInputModel:
      "**Web (Fast):** **Fastest** browser-based speech recognition, **without emotion detection**.\n\n**Whisper (Slow):** Required for **emotion detection**, but **slower** (long response time) and requires **manual stop**. Not recommended for normal use.",
    helpVoiceModel:
      "**Web:** **Fastest** voice playback, quality depends on browser and device. **Note:** In browsers like **Opera**, correctly speaking English requires installing the **English (US) speech pack**, in your Windows system settings (and similarly for Polish).\n\n**Edge:** **Best quality** with good response time.\n\n**Piper:** Has the **highest delay**, not recommended for normal use, treat it rather as an alternative.",
  },
};

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

import {
  useFloating,
  offset,
  flip,
  shift,
  size,
  arrow,
  autoUpdate,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingArrow,
  FloatingPortal,
} from "@floating-ui/react";
import type { Placement } from "@floating-ui/react";

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

const HelpTooltip: React.FC<{
  content: string;
  ariaLabel: string;
  placement?: Placement;
  lang?: string;
  tooltipId: string;
  onOpenChange?: (id: string, open: boolean) => void;
}> = ({ content, ariaLabel, placement: userPlacement = "bottom", lang: propLang, tooltipId, onOpenChange }) => {
  const arrowRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [boundary, setBoundary] = useState<HTMLElement | null>(null);
  const modalSidePadding = 18;

  // Wykrywanie języka na podstawie treści (jeśli nie podano jako props) 
  const isPolish = content.includes('Szybki') || content.includes('Empatyczny') || content.includes('Wykrywanie') || content.includes('Czytanie');
  const lang = propLang || (isPolish ? 'pl' : 'en'); // Use prop if available

  // Funkcja formatująca treść z markdownem, kolorami i dzieleniem wyrazów
  const formatContent = (text: string) => {
    // Najpierw formatujemy pogrubienia
    let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Następnie dodajemy kolory do tytułów (po formatowaniu pogrubień, aby nie zakłócać tagów)
    const colorMap: { [key: string]: string } = {
      // Tytuły profili
      'Szybki': 'rgb(59, 130, 246)', // blue-500
      'Fast': 'rgb(59, 130, 246)',
      'Normalny': 'rgb(34, 197, 94)', // green-500
      'Normal': 'rgb(34, 197, 94)',
      'Empatyczny': 'rgb(168, 85, 247)', // purple-500
      'Empathetic': 'rgb(168, 85, 247)',
      // Tytuły funkcji
      'Czytanie Wiadomości (TTS)': 'rgb(59, 130, 246)',
      'Read Messages (TTS)': 'rgb(59, 130, 246)',
      'Wykrywanie Emocji': 'rgb(168, 85, 247)',
      'Emotion Detection': 'rgb(168, 85, 247)',
      // Tytuły modeli STT
      'Web (Szybki)': 'rgb(59, 130, 246)',
      'Web (Fast)': 'rgb(59, 130, 246)',
      'Whisper (Wolny)': 'rgb(168, 85, 247)',
      'Whisper (Slow)': 'rgb(168, 85, 247)',
      // Tytuły modeli TTS
      'Web': 'rgb(59, 130, 246)',
      'Edge': 'rgb(34, 197, 94)',
      'Piper': 'rgb(168, 85, 247)',
    };
    
    // Dodajemy kolory do tytułów, dopasowując je nawet jeśli są pogrubione
    Object.entries(colorMap).forEach(([title, color]) => {
      // Tworzymy regex, który dopasuje tytuł niezależnie od tego, czy jest pogrubiony czy nie
      const regex = new RegExp(`(<strong>)?${title.replace(/[()]/g, '\\$&')}(?=:)(</strong>)?`, 'g');
      formatted = formatted.replace(regex, `<span style="color: ${color}; font-weight: 600;">${title}</span>`);
    });

    // Na koniec dodajemy dzielenie wyrazów (hyphenation) do całego tekstu, ale tylko dla języka polskiego i angielskiego
    const hyphenator = lang === 'pl' ? hyphenatePl : hyphenateEn;
    if (hyphenator) {
      formatted = hyphenator(formatted);
    }
    
    return formatted;
  };

  useEffect(() => {
    if (isOpen) {
       // Ustawiamy boundary na element modala, aby tooltip nie wychodził poza jego obszar
       const modal = document.querySelector('.settings-modal-content') as HTMLElement;
       setBoundary(modal);
    }
  }, [isOpen]);

  useEffect(() => {
    onOpenChange?.(tooltipId, isOpen);
    return () => {
      // Zamykamy tooltip przy odmontowaniu komponentu, aby uniknąć wiszących tooltipów
      onOpenChange?.(tooltipId, false);
    };
  }, [isOpen, onOpenChange, tooltipId]);

  const { refs, floatingStyles, context } = useFloating({
    placement: userPlacement,
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip({
        boundary: boundary || undefined,
        padding: modalSidePadding,
      }),
      shift({ 
        boundary: boundary || undefined, 
        padding: modalSidePadding,
      }),
      size({
        boundary: boundary || undefined,
        padding: modalSidePadding,
        apply({ availableWidth, elements }) {
          const fullTooltipWidth = Math.max(220, Math.floor(availableWidth)) + 4;
          Object.assign(elements.floating.style, {
            width: `${fullTooltipWidth}px`,
            maxWidth: `${fullTooltipWidth}px`,
            marginLeft: '-2px',
          });
        },
      }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false, enabled: !isMobile });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="w-4 h-4 rounded-full border border-gray-300 text-gray-500 text-[9px] font-bold leading-none flex items-center justify-center hover:bg-gray-100 cursor-help"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        {...getReferenceProps()}
      >
        ?
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999] focus:outline-none"
            {...getFloatingProps()}
          >
            <div className="relative rounded-xl border-[0.5px] border-slate-300/55 bg-slate-200/70 supports-[backdrop-filter]:bg-slate-200/30 backdrop-blur-xl backdrop-saturate-150 shadow-[0_18px_44px_rgba(15,23,42,0.30)] p-3 text-[11px] sm:text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-normal font-light text-justify" lang={lang} style={{ hyphens: 'auto', WebkitHyphens: 'auto' }}>
              <span dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
              <FloatingArrow
                ref={arrowRef}
                context={context}
                fill="rgba(241, 245, 249, 0.82)"
                stroke="rgba(203, 213, 225, 0.55)"
                strokeWidth={0.5}
                width={10}
                height={5}
                tipRadius={1}
                style={{ filter: "drop-shadow(0px 10px 22px rgba(15, 23, 42, 0.22))" }}
              />
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
};

const App: React.FC = () => {
  // --- KONFIGURACJA ADRESU API ---
    const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const audioQueueRef = useRef<string[]>([]); // Kolejka zdań do przetworzenia
const isPlayingAudioRef = useRef(false);    // Czy aktualnie coś gra
const currentAudioObjRef = useRef<HTMLAudioElement | null>(null); // Aktualny obiekt Audio
  const [openHelpTooltipId, setOpenHelpTooltipId] = useState<string | null>(null);
  const [hoverTooltipId, setHoverTooltipId] = useState<"stt" | "tts" | null>(null);
  const isSettingsTooltipActive = openHelpTooltipId !== null || hoverTooltipId !== null;

  const handleHelpTooltipOpenChange = (id: string, open: boolean) => {
    setOpenHelpTooltipId((prev) => {
      if (open) return id;
      return prev === id ? null : prev;
    });
  };

  // --- DOMYŚLNE USTAWIENIA NA PODSTAWIE OBSŁUGI PRZEGLĄDARKI ---
  const getDefaultSettings = (): Settings => ({
    language: "en" as const, 
    sttModel: webSpeechSupport.stt ? "browser" : "whisper",
    ttsModel: "edge", 
    enableEmotions: false,
    enableTTS: true, 
  });

  const [state, setState] = useState<AppState>({
    isRecording: false,
    isProcessing: false,
    transcript: "",
    messages: [],
    error: null,
    showSettings: false,
    settings: getDefaultSettings(),
  });
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  const [pendingTtsText, setPendingTtsText] = useState<string | null>(null);
  const [pendingPiperPlayback, setPendingPiperPlayback] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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

  // Mobile: dopasowanie wysokości do visualViewport + wykrycie klawiatury
  useEffect(() => {
    if (!isMobile || typeof window === "undefined") return;

    const updateViewport = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      setViewportHeight(height);

      if (vv) {
        const keyboardOpen = window.innerHeight - vv.height > 120;
        setIsKeyboardOpen(keyboardOpen);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  // Mobile: blokuj scroll całej strony przy otwartej klawiaturze
  useEffect(() => {
    if (!isMobile || typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    if (isKeyboardOpen) {
      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.height = "100%";
    } else {
      root.style.overflow = "";
      body.style.overflow = "";
      body.style.height = "";
    }

    return () => {
      root.style.overflow = "";
      body.style.overflow = "";
      body.style.height = "";
    };
  }, [isKeyboardOpen]);
  const [inputText, setInputText] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const t = TRANSLATIONS[state.settings.language]; // Skrót do tłumaczeń
  const isApiDailyLimitErrorActive =
    state.error === TRANSLATIONS.pl.apiDailyLimitError ||
    state.error === TRANSLATIONS.en.apiDailyLimitError;
  const displayedError = isApiDailyLimitErrorActive ? t.apiDailyLimitError : state.error;

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
  const ttsUnlockedRef = useRef(false);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);
  // Mobile WebSpeech: przechowuj bazowy tekst + najnowsze transkrypty (Android często zwraca kumulatywnie)
  const mobileBaseTextRef = useRef("");
  const mobileFinalRef = useRef("");
  const mobileInterimRef = useRef("");
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const mobileTtsKickIntervalRef = useRef<number | null>(null);
  const lastAutoRetryRef = useRef(0);

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

  // Automatyczne scrollowanie do dołu czatu przy nowych wiadomościach, zmianie statusu przetwarzania lub interim transcript (ważne dla mobile)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.isProcessing, interimTranscript]);

  useEffect(() => {
    // Jeśli użytkownik wyłączył TTS (z true na false)
    if (!state.settings.enableTTS) {
      console.log("TTS wyłączony - przerywam mówienie.");
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Hamulec ręczny
      }
     if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
    }
      if (currentAudioObjRef.current) {
        currentAudioObjRef.current.pause();
        currentAudioObjRef.current = null;
      }
      isPlayingAudioRef.current = false;
      audioQueueRef.current = [];
    }
  }, [state.settings.enableTTS]);

  // Zmiana języka powinna natychmiast zatrzymać aktualne czytanie
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
     if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
    }
    if (currentAudioObjRef.current) {
        currentAudioObjRef.current.pause();
        currentAudioObjRef.current = null;
    }
    isPlayingAudioRef.current = false;
    audioQueueRef.current = []; 
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
  const startMobileTtsKick = () => {
    if (!isMobile) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    if (mobileTtsKickIntervalRef.current !== null) {
      window.clearInterval(mobileTtsKickIntervalRef.current);
      mobileTtsKickIntervalRef.current = null;
    }

    // Na niektórych urządzeniach mobilnych, Web TTS może się "zawiesić" po dłuższym czasie bez użycia. Ten "kick" co 250ms pomaga utrzymać go aktywnym podczas odtwarzania dłuższych odpowiedzi.
    mobileTtsKickIntervalRef.current = window.setInterval(() => {
      try {
        // Jeśli synteza jest wstrzymana, wznow ją. To pomaga na urządzeniach, które mają agresywne zarządzanie energią.
        window.speechSynthesis.resume();
      } catch {
        // Nie blokuj - samo wywołanie bywa wystarczające na części przeglądarek, a na innych może rzucać błędy, które możemy ignorować.
      }
    }, 250);
  };

  const stopMobileTtsKick = () => {
    if (typeof window === "undefined") return;
    if (mobileTtsKickIntervalRef.current !== null) {
      window.clearInterval(mobileTtsKickIntervalRef.current);
      mobileTtsKickIntervalRef.current = null;
    }
  };

  const unlockWebTtsIfNeeded = () => {
    if (!isMobile) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    if (!settingsRef.current.enableTTS) return;
    if (settingsRef.current.ttsModel !== "browser") return;

    try {
      // iOS/Android: musi być wywołane w ramach user-gesture.
      // Pusty string bywa ignorowany, więc dajemy minimalny znak i wyciszamy.
      const u = new SpeechSynthesisUtterance(".");
      u.volume = 0;
      u.rate = 10;
      u.onstart = () => {
        ttsUnlockedRef.current = true;
      };
      u.onend = () => {
        ttsUnlockedRef.current = true;
      };
      u.onerror = () => {
        // Nie blokuj - samo wywołanie bywa wystarczające na części przeglądarek.
        ttsUnlockedRef.current = true;
      };

      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);

      // Nie anulujemy natychmiast.
      // Jeśli platforma i tak utnie, ustawiamy unlock po chwili.
      setTimeout(() => {
        ttsUnlockedRef.current = true;
      }, 200);
    } catch (e) {
      console.warn("⚠️ Nie udało się odblokować Web TTS:", e);
    }
  };
const splitIntoSentences = (text: string): string[] => {
    // Proste dzielenie po kropkach, wykrzyknikach i pytajnikach, 
    // ale ignoruje kropki po cyfrach (np. 1. 2024.)
    const segmenter = new Intl.Segmenter(state.settings.language === 'pl' ? 'pl' : 'en', { granularity: 'sentence' });
    const segments = segmenter.segment(text);
    return Array.from(segments).map(s => s.segment).filter(s => s.trim().length > 0);
};

// --- NOWA FUNKCJA POMOCNICZA: Pobieranie Audio ---
  const fetchAudioBlob = async (text: string, signal: AbortSignal): Promise<string | null> => {
    try {
      const cleanText = stripMarkdown(text);
      if (!cleanText.trim()) return null;

      const res = await fetch(`${API_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          language: settingsRef.current.language, // Używamy refa dla aktualności
          model: settingsRef.current.ttsModel,
        }),
        signal, // Ważne: pozwala anulować request
      });

      if (!res.ok) throw new Error("TTS Error");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log("Pobieranie TTS anulowane.");
      } else {
        console.error("Błąd pobierania TTS:", e);
      }
      return null;
    }
  };
  
 const speakText = async (text: string) => {
    if (!settingsRef.current.enableTTS) return;

    // 1. Reset i czyszczenie
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (currentAudioObjRef.current) {
      currentAudioObjRef.current.pause();
      currentAudioObjRef.current = null;
    }
    isPlayingAudioRef.current = false;
    // Anuluj poprzednie pobierania w tle
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort(); // To zabija wszystkie aktywne requesty fetch
      ttsAbortControllerRef.current = null;
    }
    // Tworzymy nowy kontroler dla tej serii zdań
    ttsAbortControllerRef.current = new AbortController();
    const currentSignal = ttsAbortControllerRef.current.signal;

    isPlayingAudioRef.current = false;
    const model = settingsRef.current.ttsModel;

    // --- ŚCIEŻKA 1: EDGE / PIPER (Streaming & Prefetching) ---
    if (model === "piper" || model === "edge") {
      isPlayingAudioRef.current = true;
      const sentences = splitIntoSentences(text);

      // Uruchamiamy pobieranie WSZYSTKICH zdań równolegle.
      // Nie czekamy (await) tutaj na wynik, tylko zbieramy Obietnice (Promises).
      // Przeglądarka sama obsłuży kolejkę requestów (zazwyczaj max 6 naraz).
      const audioPromises = sentences.map(sentence => 
        fetchAudioBlob(sentence, currentSignal)
      );

      // Pętla odtwarzania
      for (let i = 0; i < audioPromises.length; i++) {
        // Jeśli użytkownik wcisnął STOP w międzyczasie -> przerywamy pętlę
        if (currentSignal.aborted) break;

        try {
          // Tutaj czekamy na konkretne zdanie. 
          // Ponieważ requesty poszły równolegle, zdanie nr 2, 3, 4 prawdopodobnie
          // pobrały się w czasie gdy słuchaliśmy zdania nr 1.
          const audioUrl = await audioPromises[i]; 

          if (audioUrl && !currentSignal.aborted) {
            const audio = new Audio(audioUrl);
            currentAudioObjRef.current = audio;

            // Odtwarzamy i czekamy aż się skończy
            await new Promise<void>((resolve) => {
              audio.onended = () => resolve();
              audio.onerror = () => resolve();
              audio.play().catch(e => {
                console.warn("Autoplay blocked or aborted", e);
                resolve();
              });
            });
            
            // Sprzątamy pamięć po URL
            URL.revokeObjectURL(audioUrl);
          }
        } catch (err) {
          console.error("Błąd w pętli odtwarzania:", err);
        }
      }
      
      isPlayingAudioRef.current = false;
      return;
    }

    // --- LOGIKA DLA PRZEGLĄDARKI (WEB SPEECH API) ---
    if ("SpeechSynthesisUtterance" in window && "speechSynthesis" in window) {
      const cleanText = stripMarkdown(text);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      const isPolish = settingsRef.current.language === "pl";
      // Ważne: Pełny kod locale (Opera tego potrzebuje)
      const targetLang = isPolish ? "pl-PL" : "en-US";
      
      utterance.lang = targetLang;

      // 1. Pobierz głosy (force refresh)
      let voices = window.speechSynthesis.getVoices();
      
      // Jeśli lista jest pusta, spróbujmy jeszcze raz (fix dla niektórych wersji Chromium)
      if (voices.length === 0) {
          voices = availableVoices; 
      }

      if (voices.length > 0) {
        // Szukamy głosów pasujących do kodu języka (np. "en" w "en-US")
        const langCode = isPolish ? "pl" : "en";
        const langVoices = voices.filter((v) => 
          v.lang.replace('_', '-').toLowerCase().startsWith(langCode)
        );

        let selectedVoice = null;

        if (langVoices.length > 0) {
          // A. Priorytet: Microsoft (Windows Native - Opera tego używa)
          selectedVoice = langVoices.find(v => v.name.includes("Microsoft") && v.name.includes(isPolish ? "Paulina" : "David"));
          
          if (!selectedVoice) {
             selectedVoice = langVoices.find(v => v.name.includes("Microsoft"));
          }

          // B. Priorytet: Google (Chrome/Android)
          if (!selectedVoice) {
            selectedVoice = langVoices.find(v => v.name.includes("Google"));
          }

          // C. Ostateczność: Pierwszy pasujący
          if (!selectedVoice) {
            selectedVoice = langVoices[0];
          }
        }

        // PRZYPISANIE GŁOSU
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        } else {
          // Jeśli nie znaleźliśmy głosu dla danego języka, ustawiamy pierwszy dostępny głos.
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            utterance.voice = voices[0]; // Ustaw pierwszy dostępny głos
            console.warn(`⚠️ Brak zainstalowanego głosu dla języka: ${targetLang}. Używam pierwszego dostępnego głosu.`);
          } else {
            console.warn(`⚠️ Brak dostępnych głosów.`);
          }
        }
      }

      // Parametry dźwięku
      if (isPolish) {
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
      }

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      if (isMobile) {
        startMobileTtsKick();
      }

      let didStart = false;
      utterance.onstart = () => {
        didStart = true;
        setPendingTtsText(null);
      };
      utterance.onend = () => {
        setPendingTtsText(null);
        stopMobileTtsKick();
      };
      utterance.onerror = (e) => {
        console.warn("Web TTS error:", e);
        if (isMobile) setPendingTtsText(cleanText);
        stopMobileTtsKick();
      };

      window.speechSynthesis.speak(utterance);
      
      // Na mobile często zdarza się, że TTS nie startuje od razu mimo user-gesture. Ten timeout to obejście, które próbuje wznowić syntezę po chwili, a jeśli nadal nie zaczęła się, ustawia pendingTtsText, co wyzwala ponowną próbę odtwarzania w useEffect.
      if (isMobile) {
        setTimeout(() => {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }, 100);

        setTimeout(() => {
          const notSpeaking = !window.speechSynthesis.speaking;
          if (
            !didStart &&
            notSpeaking &&
            settingsRef.current.enableTTS &&
            settingsRef.current.ttsModel === "browser"
          ) {
            setPendingTtsText(cleanText);
          }
        }, 400);

        setTimeout(() => {
          stopMobileTtsKick();
        }, 45000);
      }
    }
  };
  const playPendingTts = async () => {
    if (!settingsRef.current.enableTTS) return;

    // ZMIANA: Jeśli model to NIE przeglądarka (czyli Edge lub Piper)
    if (settingsRef.current.ttsModel !== "browser") {
      const audio = piperAudioRef.current;
      if (!audio) return;
      try {
        await audio.play();
        setPendingPiperPlayback(false);
      } catch (e) {
        console.warn("Audio play still blocked:", e);
        setPendingPiperPlayback(true);
      }
      return;
    }

    unlockWebTtsIfNeeded();
    if (pendingTtsText) {
      speakText(pendingTtsText);
    }
  };

  // Mobile: gdy telefon wraca z blokady / zakładka wraca na wierzch,
  // spróbuj natychmiast wznowić TTS / audio (często dopiero wtedy zaczyna grać).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tryResume = () => {
      const now = Date.now();
      if (now - lastAutoRetryRef.current < 3000) return;
      lastAutoRetryRef.current = now;

      try {
        if ('speechSynthesis' in window && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // ignoruj
      }

      if (!settingsRef.current.enableTTS) return;

      // Jeśli model NIE jest przeglądarkowy (czyli Edge lub Piper)
      if (settingsRef.current.ttsModel !== 'browser') {
        const audio = piperAudioRef.current;
        if (audio && pendingPiperPlayback) {
          audio.play().then(() => setPendingPiperPlayback(false)).catch(() => setPendingPiperPlayback(true));
        }
        return;
      }
      if (settingsRef.current.ttsModel === 'browser' && pendingTtsText) {
        speakText(pendingTtsText);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tryResume();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', tryResume);
    window.addEventListener('pageshow', tryResume);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', tryResume);
      window.removeEventListener('pageshow', tryResume);
    };
  }, [pendingTtsText, pendingPiperPlayback]);
  // --- AKCJE ---
  const handleNewChat = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
    }
    if (currentAudioObjRef.current) {
        currentAudioObjRef.current.pause();
        currentAudioObjRef.current = null;
    }
    isPlayingAudioRef.current = false;
    audioQueueRef.current = [];
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

  const handleSendMessage = async (text: string, fromUserGesture: boolean = false) => {
    if (silenceTimerRef.current) {
     clearTimeout(silenceTimerRef.current);
     silenceTimerRef.current = null;
    }
    if (!text.trim()) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
    }
    if (currentAudioObjRef.current) {
        currentAudioObjRef.current.pause();
        currentAudioObjRef.current = null;
    }
    isPlayingAudioRef.current = false;
    audioQueueRef.current = [];


    // Mobile: odblokuj Web TTS tylko jeśli to faktycznie user-gesture
    if (fromUserGesture) {
      unlockWebTtsIfNeeded();
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

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const backendCode = data?.code;
        const backendErrorText = String(data?.error || data?.message || "").toLowerCase();
        const isApiDailyLimit =
          res.status === 429 ||
          backendCode === "API_DAILY_LIMIT_EXCEEDED" ||
          /quota|rate limit|too many requests|resource_exhausted|daily limit/.test(backendErrorText);

        throw new Error(isApiDailyLimit ? t.apiDailyLimitError : t.serverError);
      }

      if (!data?.response) {
        throw new Error(t.serverError);
      }

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
      const errorMessage = err instanceof Error ? err.message : t.serverError;
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
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
        // --- LOGIKA DLA TELEFONU (eliminująca powielanie) ---
        if (isMobile) {
            const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
            const mergeFinalAndInterim = (finalText: string, interimText: string) => {
              const f = normalize(finalText);
              const i = normalize(interimText);
              if (!i) return f;
              if (!f) return i;
              if (f.endsWith(i)) return f;
              if (i.startsWith(f)) return i;
              return `${f} ${i}`;
            };

            let latestFinal = "";
            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                latestFinal = event.results[i][0].transcript;
              }
            }

            let latestInterim = "";
            for (let i = event.results.length - 1; i >= 0; --i) {
              if (!event.results[i].isFinal) {
                latestInterim = event.results[i][0].transcript;
                break;
              }
            }

            const base = mobileBaseTextRef.current || "";
            const finalText = normalize(base ? `${base} ${latestFinal}` : latestFinal);
            const interimText = normalize(latestInterim);

            mobileFinalRef.current = finalText;
            mobileInterimRef.current = interimText;

            setInputText(finalText);
            setInterimTranscript(interimText);

            // Timer do wysyłania na mobile
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (!isProcessingSpeechRef.current) {
                const toSend = mergeFinalAndInterim(
                  mobileFinalRef.current,
                  mobileInterimRef.current
                );
                if (toSend) {
                  isProcessingSpeechRef.current = true;
                  handleSendMessage(toSend);
                }
                stopRecording();
              }
            }, 2000);
            
        } else {
            // --- LOGIKA DLA KOMPUTERA ---
            let finalChunk = "";
            let interimChunk = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalChunk += event.results[i][0].transcript;
              } else {
                interimChunk += event.results[i][0].transcript;
              }
            }

            if (finalChunk) {
              const finalTrimmed = finalChunk.trim();
              if (!isProcessingSpeechRef.current) {
                 isProcessingSpeechRef.current = true;
                 handleSendMessage(finalTrimmed);
                 stopRecording();
              }
            } else {
              setInterimTranscript(interimChunk);
            }
        }
      };

      recognition.onerror = (event: any) => {
          // Ignoruj błąd 'no-speech' na mobile, bo często się zdarza przy ciszy
          if (event.error !== 'no-speech') stopRecording();
      };
      
      recognition.onend = () => {
        // Na PC wyłączamy od razu. Na mobile zostawiamy (timer decyduje).
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

  // --- NAGRYWANIE ---
  const startRecording = async () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // NOWE CZYSZCZENIE:
    if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
    }
    if (currentAudioObjRef.current) {
        currentAudioObjRef.current.pause();
        currentAudioObjRef.current = null;
    }
    audioQueueRef.current = []; 
    isPlayingAudioRef.current = false;
    
    // Mobile: odblokuj Web TTS w user-gesture (klik mikrofonu)
    unlockWebTtsIfNeeded();
    
    // Reset flagi blokującej podwójne wiadomości
    isProcessingSpeechRef.current = false;
    // Reset transkryptów dla mobile
    mobileBaseTextRef.current = inputText;
    mobileFinalRef.current = "";
    mobileInterimRef.current = "";

    const effectiveSttModel =
      state.settings.sttModel === "browser" && !webSpeechSupport.stt
        ? "whisper"
        : state.settings.sttModel;

    setState((prev) => ({
      ...prev,
      isRecording: true,
      error: null,
      settings:
        prev.settings.sttModel === "browser" && !webSpeechSupport.stt
          ? { ...prev.settings, sttModel: "whisper", enableEmotions: false }
          : prev.settings,
    }));

    if (effectiveSttModel === "browser") {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("STT Error:", e);
        setState((prev) => ({
          ...prev,
          isRecording: false,
          settings: { ...prev.settings, sttModel: "whisper", enableEmotions: false },
        }));
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
  if (isMobile && state.settings.sttModel === "browser") {
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const mergeFinalAndInterim = (finalText: string, interimText: string) => {
      const f = normalize(finalText);
      const i = normalize(interimText);
      if (!i) return f;
      if (!f) return i;
      if (f.endsWith(i)) return f;
      if (i.startsWith(f)) return i;
      return `${f} ${i}`;
    };

    const finalText = mobileFinalRef.current || inputText;
    const interimText = mobileInterimRef.current || interimTranscript;
    const toSend = mergeFinalAndInterim(finalText, interimText);

    if (toSend && !isProcessingSpeechRef.current) {
      isProcessingSpeechRef.current = true;
      // stopRecording jest wywoływany przy kliknięciu stop (user-gesture), ale też z timera.
      // W tym miejscu nie mamy pewności, więc nie wymuszamy fromUserGesture.
      handleSendMessage(toSend);
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

  // --- PROFILE ---
  const activeProfile = (): "fast" | "normal" | "empathetic" | "custom" => {
    const { sttModel, ttsModel, enableEmotions } = state.settings;
    
    // Ustal oczekiwane modele w zależności od wsparcia przeglądarki
    const expectedStt = webSpeechSupport.stt ? "browser" : "whisper";
    const expectedFastTts = webSpeechSupport.tts ? "browser" : "piper";

    // Fast: Browser STT (lub Whisper jeśli brak) + Browser TTS (lub Piper jeśli brak) + Brak emocji
    if (sttModel === expectedStt && ttsModel === expectedFastTts && !enableEmotions) return "fast";
    
    // Normal: Browser STT (lub Whisper jeśli brak) + Edge TTS (Domyślny) + Brak emocji
    if (sttModel === expectedStt && ttsModel === "edge" && !enableEmotions) return "normal";

    // Empathetic: Whisper + Edge TTS + Emotions
    if (sttModel === "whisper" && ttsModel === "edge" && enableEmotions) return "empathetic";

    return "custom";
  };

  return (
<div className="flex flex-col h-full w-full absolute inset-0 sm:static sm:h-full sm:max-w-2xl sm:mx-auto bg-white sm:shadow-2xl overflow-hidden"
style={{
  paddingTop: 'env(safe-area-inset-top)',
  height: isMobile && viewportHeight ? `${viewportHeight}px` : undefined,
}}>      {" "}
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
        @media (min-height: 900px) and (max-width: 500px) {
          .tall-phone-title {
            font-size: 16px;
          }
          .tall-phone-status {
            font-size: 12px;
          }
          .tall-phone-header-btn {
            font-size: 18px;
          }
          .tall-phone-header-circle {
            width: 36px;
            height: 36px;
          }
          .tall-phone-header-circle-lg {
            width: 42px;
            height: 42px;
          }
          .tall-phone-bubble {
            font-size: 16px;
          }
          .tall-phone-bubble-markdown {
            font-size: 14px;
          }
        }
      `}</style>
      <header className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-blue-100 p-1.5 sm:p-2 rounded-xl text-blue-600 flex-shrink-0">
            <i className="fas fa-plane-departure text-base sm:text-xl"></i>
          </div>
          <div className="min-w-0">
            {/* Tytuł: responsive */}
            <h1 className="font-bold text-gray-800 text-sm sm:text-lg tall-phone-title truncate">
              {t.title}
            </h1>

            {/* Status Zmienny */}
            <p
              className={`text-[10px] sm:text-xs tall-phone-status font-medium flex items-center gap-1 ${
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
          {/* Szybkie ustawienia */}
          <button
            onClick={() => {
              if (state.settings.enableTTS && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              
              const nextEnable = !state.settings.enableTTS;
              if (nextEnable) unlockWebTtsIfNeeded();

              setState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enableTTS: nextEnable,
                  ttsModel:
                    nextEnable && !webSpeechSupport.tts
                      ? "piper"
                      : prev.settings.ttsModel,
                },
              }));
            }}
            className={`rounded-full flex items-center justify-center transition-all text-base sm:text-lg tall-phone-header-btn ${
              state.settings.enableTTS
                ? "w-9 h-9 sm:w-11 sm:h-11 tall-phone-header-circle tall-phone-header-circle-lg bg-green-100 text-green-600"
                : "w-9 h-9 tall-phone-header-circle bg-transparent text-gray-300 hover:text-gray-400"
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
              setState((prev) => {
                const nextEnableEmotions = !prev.settings.enableEmotions;
                return {
                  ...prev,
                  settings: {
                    ...prev.settings,
                    enableEmotions: nextEnableEmotions,
                    sttModel: nextEnableEmotions
                      ? "whisper"
                      : (webSpeechSupport.stt ? "browser" : "whisper"),
                  },
                };
              })
            }
            className={`rounded-full flex items-center justify-center transition-all text-base sm:text-lg tall-phone-header-btn ${
              state.settings.enableEmotions
                ? "w-9 h-9 sm:w-11 sm:h-11 tall-phone-header-circle tall-phone-header-circle-lg bg-purple-100 text-purple-600"
                : "w-9 h-9 tall-phone-header-circle bg-transparent text-gray-300 hover:text-gray-400"
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

          {/* Nowy chat */}
          <button
            onClick={handleNewChat}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors text-base sm:text-xl tall-phone-header-btn"
            title={t.newChat}
          >
            <i className="fas fa-plus"></i>
          </button>

          {/* Ustawienia */}
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, showSettings: true }))
            }
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-base sm:text-xl tall-phone-header-btn"
            title={t.settingsTitle}
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>
      {/* --- CHAT --- */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-2 bg-gray-50/50">
        {state.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* UNIWERSALNY SZARY DYMEK (Styl PC, Logika hybrydowa) */}
        {(interimTranscript || (isMobile && state.isRecording && inputText)) && (
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-500 rounded-tr-none border border-gray-200 opacity-80 italic">
              <p className="text-sm">
                {isMobile ? (
                  /* Na mobile pokazujemy cały sklejony tekst w szarym dymku */
                  <span>
                    {inputText} {interimTranscript}
                  </span>
                ) : (
                  /* Na PC pokazujemy tylko aktualnie wykrywany fragment */
                  <span>{interimTranscript}...</span>
                )}
              </p>
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

      {state.error && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[7.5rem] sm:bottom-[8.5rem] z-40 w-[92%] sm:w-[80%] max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-2xl border border-red-200 bg-red-50/95 backdrop-blur-sm shadow-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <i className="fas fa-circle-exclamation text-red-500 mt-0.5"></i>
              <div className="flex-1 text-red-700 text-xs sm:text-sm leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => <span {...props} />,
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-semibold"
                      />
                    ),
                  }}
                >
                  {displayedError}
                </ReactMarkdown>
              </div>
              <button
                onClick={() => setState((prev) => ({ ...prev, error: null }))}
                className="text-red-400 hover:text-red-600 transition-colors"
                aria-label="Close error popup"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
      <footer
        className={`bg-white border-t ${
          isMobile && isKeyboardOpen ? "px-2 pt-1.5 pb-1" : "p-3 sm:p-4"
        }`}
      >
        {/* Mobile fallback: jeśli Web TTS zablokowany, pokaż przycisk do ręcznego odtworzenia */}
        {isMobile && state.settings.enableTTS && (
          ((state.settings.ttsModel === "browser" && pendingTtsText) || (state.settings.ttsModel === "piper" && pendingPiperPlayback))
        ) && (
          <div className="mb-2 flex justify-center">
            <button
              onClick={() => {
                playPendingTts();
              }}
              className="text-xs font-semibold px-4 py-2 rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 transition-colors"
            >
              {t.tapToPlayTTS}
            </button>
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
                      handleSendMessage(inputText, true);
                    }
                  }}
                  placeholder={t.inputPlaceholder}
                  className="bg-transparent w-full h-full outline-none text-gray-700 placeholder-gray-400 text-sm resize-none py-3 sm:py-4 pr-3 overflow-y-auto custom-scrollbar"
                />
                <button
                  onClick={() => handleSendMessage(inputText, true)}
                  className="text-blue-600 hover:text-blue-800 ml-2 flex-shrink-0"
                >
                  <i className="fas fa-paper-plane text-lg sm:text-xl"></i>
                </button>
              </>
            )}
          </div>
        </div>

        <div
          className={`text-[10px] text-gray-300 text-center font-medium ${
            isMobile && isKeyboardOpen
              ? "hidden"
              : isMobile
              ? "pb-2"
              : ""
          }`}
        >
          &copy; {new Date().getFullYear()} {t.copyright}
        </div>
      </footer>
      {/* --- MODAL USTAWIEŃ --- */}
      {state.showSettings && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="settings-modal-content bg-white w-full sm:max-w-md rounded-3xl p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] mx-auto relative">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                {t.settingsTitle}
              </h2>
              <button
                onClick={() =>
                  (setOpenHelpTooltipId(null), setHoverTooltipId(null), setState((prev) => ({ ...prev, showSettings: false })))
                }
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {isSettingsTooltipActive && (
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-900/5 backdrop-blur-[2px] backdrop-saturate-75 z-10" />
            )}

            <div className="space-y-6 relative">
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
                    className={`flex-1 py-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                      state.settings.language === "en"
                        ? "border-blue-500 bg-blue-50"
                        : "border-transparent bg-gray-50 opacity-60"
                    }`}
                  >
                    <span
                      className="fi fi-us"
                      style={{ fontSize: "1.6rem", borderRadius: "0.375rem" }}
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
                    className={`flex-1 py-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                      state.settings.language === "pl"
                        ? "border-blue-500 bg-blue-50"
                        : "border-transparent bg-gray-50 opacity-60"
                    }`}
                  >
                    <span
                      className="fi fi-pl"
                      style={{ fontSize: "1.6rem", borderRadius: "0.375rem" }}
                    ></span>
                    <span className="text-xs font-medium text-gray-700">
                      Polish
                    </span>
                  </button>
                </div>
              </div>

              {/* Profile */}
              <div>
                <div className={`flex items-center gap-2 mb-2 ${openHelpTooltipId === "quickProfiles" ? "relative z-20" : ""}`}>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t.predefinedLabel}
                  </label>
                  <HelpTooltip
                    tooltipId="quickProfiles"
                    content={t.helpQuickProfiles}
                    ariaLabel={`${t.predefinedLabel} help`}
                    lang={state.settings.language}
                    onOpenChange={handleHelpTooltipOpenChange}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            sttModel: webSpeechSupport.stt ? "browser" : "whisper",
                            ttsModel: webSpeechSupport.tts ? "browser" : "piper",
                            enableEmotions: false,
                            enableTTS: false,
                          },
                        }))
                      }
                      className={`w-full px-2 sm:px-3 py-2 rounded-2xl border-2 transition-all flex flex-col items-center text-center ${
                        activeProfile() === "fast"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <div className="font-semibold text-gray-800 text-[12px] sm:text-[13px] mb-0.5 whitespace-nowrap">
                        {state.settings.language === "pl" ? "Szybki" : "Fast"}
                      </div>
                      <div className="text-xl">⚡</div>
                    </button>
                    <div className="text-[8.5px] sm:text-[10px] text-gray-400 leading-tight mt-1.5 text-center">
                      {t.profileFastDesc}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            sttModel: webSpeechSupport.stt ? "browser" : "whisper",
                            ttsModel: "edge",
                            enableEmotions: false,
                            enableTTS: true,
                          },
                        }))
                      }
                      className={`w-full px-2 sm:px-3 py-2 rounded-2xl border-2 transition-all flex flex-col items-center text-center ${
                        activeProfile() === "normal"
                          ? "border-green-500 bg-green-50"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <div className="font-semibold text-gray-800 text-[12px] sm:text-[13px] mb-0.5 whitespace-nowrap">
                        {state.settings.language === "pl" ? "Normalny" : "Normal"}
                      </div>
                      <div className="text-xl">👍</div>
                    </button>
                    <div className="text-[8.5px] sm:text-[10px] text-gray-400 leading-tight mt-1.5 text-center">
                      {t.profileNormalDesc}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            sttModel: "whisper",
                            ttsModel: "edge", // TTS Edge jest bardziej ekspresyjny, więc lepiej pasuje do profilu empatycznego
                            enableEmotions: true,
                            enableTTS: true,
                          },
                        }))
                      }
                      className={`w-full px-2 sm:px-3 py-2 rounded-2xl border-2 transition-all flex flex-col items-center text-center ${
                        activeProfile() === "empathetic"
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <div className="font-semibold text-gray-800 text-[12px] sm:text-[13px] mb-0.5 whitespace-nowrap">
                        {state.settings.language === "pl" ? "Empatyczny" : "Empathetic"}
                      </div>
                      <div className="text-xl">❤️</div>
                    </button>
                    <div className="text-[8.5px] sm:text-[10px] text-gray-400 leading-tight mt-1.5 text-center">
                      {t.profileEmpDesc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Zaawansowane */}
              <div className="pt-0">
                <div className={`flex items-center gap-2 mb-3 ${openHelpTooltipId === "advanced" ? "relative z-20" : ""}`}>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t.advancedLabel}
                  </div>
                  <HelpTooltip
                    tooltipId="advanced"
                    content={t.helpAdvanced}
                    ariaLabel={`${t.advancedLabel} help`}
                    lang={state.settings.language}
                    onOpenChange={handleHelpTooltipOpenChange}
                  />
                </div>

                {/*  TTS i Emocje - checkboxy */}
                <div className="mb-6 border border-gray-200 rounded-2xl bg-white">
                  <label className="flex items-center justify-between px-3 py-3 rounded-t-2xl cursor-pointer hover:bg-gray-50 gap-3">
                    <span className="text-[12px] font-medium text-gray-700">
                      {t.enableTTS}
                    </span>
                    <span
                      className={`w-[18px] h-[18px] flex items-center justify-center rounded-full border transition-colors ${
                        state.settings.enableTTS
                          ? "bg-gray-500 border-gray-500"
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
                        if (newVal) unlockWebTtsIfNeeded();
                        setState((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            enableTTS: newVal,
                            ttsModel: newVal && !webSpeechSupport.tts ? "piper" : prev.settings.ttsModel,
                          },
                        }));
                      }}
                      className="sr-only"
                    />
                  </label>

                  <div className="border-t border-gray-200" />

                  <label
                    className={`flex items-center justify-between px-3 rounded-b-2xl cursor-pointer hover:bg-gray-50 gap-3 ${
                      state.settings.sttModel === "browser" ? "py-2" : "py-3"
                    } ${
                      state.settings.sttModel === "browser" ? "opacity-50" : ""
                    }`}
                  >
                    <div>
                      <span className="text-[12px] font-medium text-gray-700 block">
                        {t.enableEmotions}
                      </span>
                      {state.settings.sttModel === "browser" && (
                        <span className="text-[9px] text-red-500 block">
                          {t.whisperReq}
                        </span>
                      )}
                    </div>
                    <span
                      className={`w-[18px] h-[18px] flex items-center justify-center rounded-full border transition-colors ${
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

                {/* Wybór STT */}
                <div className={`mb-5 ${openHelpTooltipId === "sttModel" ? "relative z-20" : ""}`}>
                  <div className={`flex items-center gap-2 mb-1 ${openHelpTooltipId === "sttModel" ? "relative z-20" : ""}`}>
                    <label className="text-[12px] text-gray-500 font-semibold block">
                      {t.inputModelLabel}
                    </label>
                    <HelpTooltip
                      tooltipId="sttModel"
                      content={t.helpInputModel}
                      ariaLabel={`${t.inputModelLabel} help`}
                      lang={state.settings.language}
                      onOpenChange={handleHelpTooltipOpenChange}
                    />
                  </div>
                  <div className={`flex bg-gray-100 px-0.5 py-0.5 rounded-lg ${hoverTooltipId === "stt" ? "relative z-20" : ""}`}>
                    <div
                      className={`relative flex-1 group ${hoverTooltipId === "stt" ? "z-20" : ""}`}
                      onMouseEnter={!webSpeechSupport.stt ? () => setHoverTooltipId("stt") : undefined}
                      onMouseLeave={!webSpeechSupport.stt ? () => setHoverTooltipId(null) : undefined}
                    >
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
                        }
                        disabled={!webSpeechSupport.stt}
                        aria-disabled={!webSpeechSupport.stt}
                        className={`w-full py-1.5 rounded-md text-[12px] font-medium transition-all ${
                          state.settings.sttModel === "browser"
                            ? "bg-white shadow text-blue-500"
                            : webSpeechSupport.stt ? "text-gray-500 cursor-pointer" : "text-gray-400 cursor-not-allowed"
                        } ${!webSpeechSupport.stt ? "opacity-80" : ""}`}
                      >
                        {t.modelWeb}
                      </button>

                      {!webSpeechSupport.stt && (
                        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-50">
                          <div className="rounded-xl border-[0.5px] border-slate-300/55 bg-slate-200/70 supports-[backdrop-filter]:bg-slate-200/30 backdrop-blur-xl backdrop-saturate-150 shadow-[0_12px_28px_rgba(15,23,42,0.24)] text-slate-700 text-[10px] sm:text-[11px] leading-relaxed px-2 py-1.5 sm:px-3 sm:py-2 w-max max-w-[150px] sm:max-w-[200px] text-center">
                            {t.webSttNotSupported}
                          </div>
                          <svg
                            className="mx-auto"
                            width="12"
                            height="6"
                            viewBox="0 0 12 6"
                            aria-hidden="true"
                            style={{ filter: "drop-shadow(0px 10px 22px rgba(15, 23, 42, 0.22))" }}
                          >
                            <path
                              d="M1 0.5 L6 5.5 L11 0.5 Z"
                              fill="rgba(241, 245, 249, 0.82)"
                              stroke="rgba(203, 213, 225, 0.55)"
                              strokeWidth="0.5"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, sttModel: "whisper" },
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all ${
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

                {/* Wybór TTS */}
                <div className={`${openHelpTooltipId === "ttsModel" || hoverTooltipId === "tts" ? "relative z-20" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-[12px] text-gray-500 font-semibold block">
                      {t.voiceModelLabel}
                    </label>
                    <HelpTooltip
                      tooltipId="ttsModel"
                      content={t.helpVoiceModel}
                      ariaLabel={`${t.voiceModelLabel} help`}
                      placement="top"
                      lang={state.settings.language}
                      onOpenChange={handleHelpTooltipOpenChange}
                    />
                  </div>
                  <div className="flex bg-gray-100 px-0.5 py-0.5 rounded-lg">
                    <div
                      className={`relative flex-1 group ${hoverTooltipId === "tts" ? "z-20" : ""}`}
                      onMouseEnter={!webSpeechSupport.tts ? () => setHoverTooltipId("tts") : undefined}
                      onMouseLeave={!webSpeechSupport.tts ? () => setHoverTooltipId(null) : undefined}
                    >
                      <button
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, ttsModel: "browser" },
                          }))
                        }
                        disabled={!webSpeechSupport.tts}
                        aria-disabled={!webSpeechSupport.tts}
                        className={`w-full py-1.5 rounded-md text-[12px] font-medium transition-all ${
                          state.settings.ttsModel === "browser"
                            ? "bg-white shadow text-blue-500"
                            : webSpeechSupport.tts ? "text-gray-500 cursor-pointer" : "text-gray-300 cursor-not-allowed"
                        } ${!webSpeechSupport.tts ? "opacity-50" : ""}`}
                      >
                        {t.modelWeb}
                      </button>

                      {!webSpeechSupport.tts && (
                        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-50">
                          <div className="rounded-xl border-[0.5px] border-slate-300/55 bg-slate-200/70 supports-[backdrop-filter]:bg-slate-200/30 backdrop-blur-xl backdrop-saturate-150 shadow-[0_12px_28px_rgba(15,23,42,0.24)] text-slate-700 text-[10px] sm:text-[11px] leading-relaxed px-2 py-1.5 sm:px-3 sm:py-2 w-max max-w-[150px] sm:max-w-[200px] text-center">
                            {t.webTtsNotSupported}
                          </div>
                          <svg
                            className="mx-auto"
                            width="12"
                            height="6"
                            viewBox="0 0 12 6"
                            aria-hidden="true"
                            style={{ filter: "drop-shadow(0px 10px 22px rgba(15, 23, 42, 0.22))" }}
                          >
                            <path
                              d="M1 0.5 L6 5.5 L11 0.5 Z"
                              fill="rgba(241, 245, 249, 0.82)"
                              stroke="rgba(203, 213, 225, 0.55)"
                              strokeWidth="0.5"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, ttsModel: "edge" },
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                        state.settings.ttsModel === "edge"
                          ? "bg-white shadow text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {t.modelEdge}
                    </button>
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, ttsModel: "piper" },
                        }))
                      }
                      className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all ${
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
