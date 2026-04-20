import { create } from "zustand";
import type { Track } from "./types";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0–1
  play: (track: Track) => void;
  pause: () => void;
  toggle: (track: Track) => void;
  setProgress: (p: number) => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  play: (track) => set({ currentTrack: track, isPlaying: true, progress: 0 }),
  pause: () => set({ isPlaying: false }),
  toggle: (track) => {
    const state = get();
    if (state.currentTrack?.id === track.id) {
      set({ isPlaying: !state.isPlaying });
    } else {
      set({ currentTrack: track, isPlaying: true, progress: 0 });
    }
  },
  setProgress: (p) => set({ progress: p }),
  stop: () => set({ currentTrack: null, isPlaying: false, progress: 0 }),
}));

interface AppState {
  tracks: Track[];
  setTracks: (tracks: Track[]) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tracks: [],
  setTracks: (tracks) => set({ tracks }),
  addTrack: (track) => set((s) => ({ tracks: [track, ...s.tracks] })),
  updateTrack: (id, updates) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTrack: (id) =>
    set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),
}));
