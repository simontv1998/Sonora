export interface Track {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  genre: string | null;
  mood: string | null;
  lyrics: string | null;
  description: string | null;
  tags: string[];
  duration_seconds: number | null;
  audio_url: string | null;
  waveform_data: number[] | null;
  parent_track_id: string | null;
  is_remix: boolean;
  is_public: boolean;
  share_slug: string | null;
  play_count: number;
  status: "pending" | "generating" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface GenerateRequest {
  prompt: string;
  genre?: string;
  mood?: string;
  duration?: number; // seconds, default 30
  parentTrackId?: string; // for remixes
}

export interface MetadataResponse {
  title: string;
  lyrics: string | null;
  description: string;
  tags: string[];
}

export interface GenerateResponse {
  trackId: string;
  status: "generating";
}
