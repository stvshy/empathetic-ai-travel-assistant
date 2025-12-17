
export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
}

export interface AppState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  messages: Message[];
  error: string | null;
}
