export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
}

export type STTModel = "browser" | "whisper";
export type TTSModel = "browser" | "piper";

export interface Settings {
  language: "pl" | "en";
  sttModel: STTModel;
  ttsModel: TTSModel;
  enableEmotions: boolean; // Nowe: Niezależny przełącznik emocji
  enableTTS: boolean; // Nowe: Niezależny przełącznik czytania
}

export interface AppState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  messages: Message[];
  error: string | null;
  settings: Settings;
  showSettings: boolean;
}
