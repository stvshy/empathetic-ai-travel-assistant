import React, { useState, useEffect, useRef, useCallback } from "react";
import { generateTravelResponse } from "./services/geminiService";
import { Message, AppState } from "./types";
import ChatBubble from "./components/ChatBubble";

// Web Speech API interfaces (available in Chrome/Safari)
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const App: React.FC = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<AppState>({
    isRecording: false,
    isProcessing: false,
    messages: [
      { 
        id: "initial",
        role: "assistant",
        text: "Cześć! Jestem Twoim Osobistym Architektem Podróży. Gdzie chciałbyś się wybrać?",
        timestamp: new Date(),
      },
    ],
    error: null,
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);


  // Auto-scroll to bottom of chat
  useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop =
      chatContainerRef.current.scrollHeight;
  }
}, [state.messages, state.isProcessing]);

  const toggleRecording = async () => {
    if (state.isRecording) {
      mediaRecorderRef.current?.stop();
      setState((prev) => ({ ...prev, isRecording: false }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        await sendAudio(audioBlob);
      };

      mediaRecorder.start();
      setState((prev) => ({ ...prev, isRecording: true, error: null }));
    } catch {
      setState((prev) => ({
        ...prev,
        error: "Nie można uzyskać dostępu do mikrofonu.",
      }));
    }
  };


  const sendAudio = async (audioBlob: Blob) => {
    setState((prev) => ({ ...prev, isProcessing: true }));

    const formData = new FormData();
    formData.append("audio", audioBlob, "input.webm");

    try {
      const response = await fetch("http://localhost:5000/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error();
      }

      const { text } = await response.json();
      // backend returns: { text: "AI response" }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        text,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: "Błąd backendu.",
      }));
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
            <i className="fas fa-plane-departure text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-lg">
              Travel Assistant
            </h1>
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Dostępny
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            setState((prev) => ({
              ...prev,
              messages: [prev.messages[0]],
              error: null,
            }))
          }
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Resetuj rozmowę"
        >
          <i className="fas fa-rotate-left"></i>
        </button>
      </header>

      {/* Chat Area */}
      <main
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-2 bg-gray-50/50"
      >
        {state.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}


        {state.isRecording && (
          <div className="flex justify-end mb-4">
            <div className="bg-blue-50 text-blue-600 rounded-2xl px-4 py-3 italic text-sm">
              <i className="fas fa-microphone animate-pulse mr-2"></i>
              Nagrywanie...
            </div>
          </div>
        )}

        {state.isProcessing && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          </div>
        )}

        {state.error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs text-center border border-red-100">
            {state.error}
          </div>
        )}
      </main>

      {/* Control Area */}
      <footer className="p-6 bg-white border-t">
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            {state.isRecording
              ? "Mów teraz..."
              : "Kliknij mikrofon, aby zaplanować podróż"}
          </p>

          <button
            onClick={toggleRecording}
            disabled={state.isProcessing}
            className={`
              relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
              ${
                state.isRecording
                  ? "bg-red-500 scale-110 shadow-lg shadow-red-200"
                  : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
              }
              ${
                state.isProcessing
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }
            `}
          >
            {state.isRecording ? (
              <div className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-30"></div>
            ) : null}
            <i
              className={`fas ${
                state.isRecording ? "fa-stop" : "fa-microphone"
              } text-2xl text-white`}
            ></i>
          </button>

          <div className="text-[10px] text-gray-300 text-center max-w-xs">
            &copy; {new Date().getFullYear()} Mateusz Staszków. All rights
            reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
