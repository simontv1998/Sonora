"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { Track } from "@/lib/types";

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

export default function SharedTrackPage({ params }: { params: { id: string } }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tracks")
      .select("*")
      .eq("share_slug", params.id)
      .eq("is_public", true)
      .single()
      .then(({ data }) => {
        setTrack(data as Track | null);
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("ended", () => setIsPlaying(false));
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("ended", () => setIsPlaying(false));
    };
  }, [track]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <div className="text-4xl mb-4">♪</div>
          <h1 className="font-mono font-bold text-xl mb-2">Track not found</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            This track may have been removed or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {track.audio_url && <audio ref={audioRef} src={track.audio_url} preload="auto" />}

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}>♪</div>
          <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>SONORA</span>
        </div>

        <div className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h1 className="font-mono font-bold text-2xl text-center mb-1">{track.title}</h1>
          <p className="text-center text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            {track.genre} · {track.mood} · {formatTime(track.duration_seconds || 0)}
          </p>

          <button onClick={togglePlay}
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl mb-6 transition-all"
            style={{ background: isPlaying ? "#a855f7" : "rgba(255,255,255,0.08)" }}>
            {isPlaying ? "❚❚" : "▶"}
          </button>

          {/* Progress bar */}
          <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg, #a855f7, #06b6d4)" }} />
          </div>
          <div className="flex justify-between text-xs font-mono mb-6" style={{ color: "rgba(255,255,255,0.2)" }}>
            <span>{formatTime((track.duration_seconds || 0) * progress)}</span>
            <span>{formatTime(track.duration_seconds || 0)}</span>
          </div>

          {track.description && (
            <p className="text-sm italic text-center mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
              {track.description}
            </p>
          )}

          {track.lyrics && (
            <pre className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-xl text-center"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.3)" }}>
              {track.lyrics}
            </pre>
          )}
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
          Made with Sonora AI Music Studio
        </p>
      </div>
    </div>
  );
}
