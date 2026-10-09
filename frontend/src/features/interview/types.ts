export interface SummaryBlock {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  estimated_level: string;
}

export interface InterviewSummary {
  correct: number;
  partial: number;
  wrong: number;
  summary: SummaryBlock;
}

export interface Message {
  role: "user" | "interviewer";
  text: string;
}

export interface VoiceEvent {
  type: string;
  transcript?: string;
  item_id?: string;
  response_id?: string;
  event_id?: string;
}

export interface VoiceAnswer {
  sdp: string;
  revision: number;
}
