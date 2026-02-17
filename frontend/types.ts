export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
}

export type STTModel = "browser" | "whisper";

export type TTSModel = "browser" | "piper" | "edge";

export interface Settings {
  language: "pl" | "en";
  sttModel: STTModel;
  ttsModel: TTSModel;
  enableEmotions: boolean;
  enableTTS: boolean;
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