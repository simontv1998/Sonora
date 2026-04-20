"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { usePlayerStore, useAppStore } from "@/lib/store";
import type { Track, GenerateRequest } from "@/lib/types";

// ─── Constants ───
const GENRES = ["Pop", "Hip Hop", "Rock", "Electronic", "Jazz", "R&B", "Classical", "Lo-Fi", "Ambient", "Latin"];
const MOODS = ["Energetic", "Chill", "Melancholic", "Uplifting", "Dark", "Dreamy", "Aggressive", "Romantic"];

// ─── Helpers ───
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

// Deterministic per-track waveform so bars don't flicker on re-render
function seededWaveform(id: string, bars = 60): number[] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Array.from({ length: bars }, () => {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    return ((h >>> 0) / 0xffffffff) * 0.6 + 0.2;
  });
}

// ─── Waveform Component ───
function Waveform({ data, progress = 0, height = 48, onClick }: {
  data: number[];
  progress?: number;
  height?: number;
  onClick?: (pct: number) => void;
}) {
  const barW = 3, gap = 2;
  const w = data.length * (barW + gap);
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={onClick ? "cursor-pointer" : ""}
      onClick={(e) => {
        if (!onClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onClick(e.nativeEvent.offsetX / rect.width);
      }}
    >
      {data.map((v, i) => {
        const barH = v * height;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={(height - barH) / 2}
            width={barW}
            height={barH}
            rx={1.5}
            fill={i / data.length < progress ? "#a855f7" : "rgba(255,255,255,0.12)"}
          />
        );
      })}
    </svg>
  );
}

// ─── Pill Selector ───
function PillSelect({ items, selected, onSelect, accent = "#a855f7" }: {
  items: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = selected === item;
        return (
          <button
            key={item}
            onClick={() => onSelect(active ? null : item)}
            className="px-4 py-1.5 rounded-full text-sm transition-all"
            style={{
              border: `1.5px solid ${active ? accent : "rgba(255,255,255,0.1)"}`,
              background: active ? `${accent}18` : "rgba(255,255,255,0.03)",
              color: active ? accent : "rgba(255,255,255,0.5)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

// ─── Audio Player (bottom bar) ───
function AudioPlayerBar() {
  const { currentTrack, isPlaying, progress, toggle, setProgress } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.audio_url) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.addEventListener("timeupdate", update);
    return () => audio.removeEventListener("timeupdate", update);
  }, [currentTrack, setProgress]);

  if (!currentTrack) return null;

  const fakeWaveform = currentTrack.waveform_data || seededWaveform(currentTrack.id);

  return (
    <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-50"
      style={{ background: "rgba(10,10,15,0.92)", borderColor: "rgba(255,255,255,0.06)" }}>
      {currentTrack.audio_url && (
        <audio ref={audioRef} src={currentTrack.audio_url} preload="auto" />
      )}
      <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-4">
        <button onClick={() => toggle(currentTrack)}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: isPlaying ? "#a855f7" : "rgba(255,255,255,0.08)" }}>
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold font-mono truncate">{currentTrack.title}</span>
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
              {formatTime((currentTrack.duration_seconds || 0) * progress)} / {formatTime(currentTrack.duration_seconds || 0)}
            </span>
          </div>
          <Waveform data={fakeWaveform} progress={progress} height={28} onClick={(p) => {
            if (audioRef.current && currentTrack.audio_url) {
              audioRef.current.currentTime = p * (audioRef.current.duration || 0);
            }
            setProgress(p);
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Track Card ───
function TrackCard({ track, onSelect, isSelected }: {
  track: Track;
  onSelect: (t: Track) => void;
  isSelected: boolean;
}) {
  const { toggle, currentTrack, isPlaying, progress } = usePlayerStore();
  const playing = currentTrack?.id === track.id && isPlaying;
  const waveform = track.waveform_data || seededWaveform(track.id);

  return (
    <div
      onClick={() => onSelect(track)}
      className="rounded-2xl p-4 cursor-pointer transition-all animate-fade-in"
      style={{
        background: isSelected ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isSelected ? "rgba(168,85,247,0.25)" : track.status === "failed" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono font-semibold text-sm mb-1 truncate">{track.title}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {track.genre} · {track.mood} · {formatTime(track.duration_seconds || 0)}
            {track.is_remix && " · Remix"}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); toggle(track); }}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors text-sm"
          style={{ background: playing ? "#a855f7" : "rgba(255,255,255,0.06)" }}>
          {track.status === "failed" ? "✕" : track.status === "generating" ? "⟳" : playing ? "❚❚" : "▶"}
        </button>
      </div>
      <Waveform data={waveform} progress={playing ? progress : 0} height={28} />
      <div className="mt-2 text-xs truncate" style={{ color: "rgba(255,255,255,0.2)" }}>
        &ldquo;{track.prompt}&rdquo;
      </div>
    </div>
  );
}

// ─── Main App ───
export default function Home() {
  const supabase = createClient();
  const { tracks, setTracks, addTrack, updateTrack, removeTrack } = useAppStore();
  const { toggle, currentTrack, isPlaying } = usePlayerStore();

  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<"create" | "library">("create");
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [remixSuggestions, setRemixSuggestions] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load tracks
  useEffect(() => {
    if (!user) return;
    supabase
      .from("tracks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTracks(data as Track[]); });
  }, [user]);

  // Auth handler
  const handleAuth = async () => {
    setAuthError("");
    const fn = authMode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn.call(supabase.auth, { email, password });
    if (error) setAuthError(error.message);
  };

  // Generate track
  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenProgress(0);
    setGenError(null);

    const interval = setInterval(() => {
      setGenProgress((p) => Math.min(p + Math.random() * 6, 92));
    }, 500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ prompt, genre, mood, duration: 15 } as GenerateRequest),
      });

      clearInterval(interval);
      setGenProgress(100);

      const data = await res.json();
      if (data.track) {
        addTrack(data.track);
        setSelectedTrack(data.track);
        setPrompt("");
        setView("library");
      }
    } catch (err: any) {
      console.error(err);
      setGenError(err?.message || "Generation failed. Please try again.");
    } finally {
      clearInterval(interval);
      setGenerating(false);
      setGenProgress(0);
    }
  };

  // Share track
  const handleShare = async (track: Track) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ trackId: track.id }),
    });
    const data = await res.json();
    if (data.shareUrl) {
      setShareUrl(data.shareUrl);
      navigator.clipboard?.writeText(data.shareUrl);
    }
  };

  // Delete track
  const handleDelete = async (track: Track) => {
    await supabase.from("tracks").delete().eq("id", track.id);
    if (track.audio_url) {
      await supabase.storage.from("tracks").remove([`${user.id}/${track.id}.mp3`]);
    }
    removeTrack(track.id);
    if (selectedTrack?.id === track.id) setSelectedTrack(null);
  };

  // Remix suggestions
  const loadRemixSuggestions = async (track: Track) => {
    const res = await fetch(`/api/remix?trackId=${track.id}`);
    const data = await res.json();
    if (data.suggestions) setRemixSuggestions(data.suggestions);
  };

  // ─── Auth Screen ───
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}>♪</div>
            <span className="font-mono font-bold text-2xl tracking-tight">SONORA</span>
          </div>
          <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              {(["signup", "login"] as const).map((m) => (
                <button key={m} onClick={() => setAuthMode(m)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                  style={{
                    background: authMode === m ? "rgba(168,85,247,0.15)" : "transparent",
                    color: authMode === m ? "#c084fc" : "rgba(255,255,255,0.35)",
                  }}>
                  {m === "signup" ? "Sign Up" : "Log In"}
                </button>
              ))}
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full mb-3 px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0f0f0" }} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password"
              className="w-full mb-4 px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0f0f0" }} />
            {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
            <button onClick={handleAuth}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff" }}>
              {authMode === "signup" ? "Create Account" : "Log In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main UI ───
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl px-5 py-4 flex items-center justify-between"
        style={{ background: "rgba(10,10,15,0.8)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: "linear-gradient(135deg, #a855f7, #06b6d4)" }}>♪</div>
          <span className="font-mono font-bold text-lg tracking-tight">SONORA</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            {(["create", "library"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
                style={{
                  background: view === v ? "rgba(168,85,247,0.15)" : "transparent",
                  color: view === v ? "#c084fc" : "rgba(255,255,255,0.35)",
                }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)" }}>
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-7 pb-36">
        {/* CREATE VIEW */}
        {view === "create" && (
          <div className="animate-fade-in">
            <h1 className="font-mono font-bold text-2xl mb-1"
              style={{ background: "linear-gradient(90deg, #f0f0f0, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Create a track
            </h1>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.3)" }}>
              Describe the music you want to hear.
            </p>

            <div className="rounded-2xl p-1 mb-6"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="A melancholic piano ballad with strings, building to an epic crescendo..."
                disabled={generating} rows={3}
                className="w-full bg-transparent px-4 py-3.5 text-sm outline-none resize-none leading-relaxed"
                style={{ color: "#f0f0f0" }} />
              <div className="flex justify-end px-2 pb-2">
                <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
                  className="px-7 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                  style={{
                    background: generating || !prompt.trim() ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #a855f7, #7c3aed)",
                    color: generating || !prompt.trim() ? "rgba(255,255,255,0.15)" : "#fff",
                    cursor: generating || !prompt.trim() ? "not-allowed" : "pointer",
                  }}>
                  {generating ? "Generating..." : "✦ Generate"}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2.5"
                style={{ color: "rgba(255,255,255,0.25)" }}>Genre</label>
              <PillSelect items={GENRES} selected={genre} onSelect={setGenre} />
            </div>
            <div className="mb-7">
              <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2.5"
                style={{ color: "rgba(255,255,255,0.25)" }}>Mood</label>
              <PillSelect items={MOODS} selected={mood} onSelect={setMood} accent="#06b6d4" />
            </div>

            {genError && (
              <div className="rounded-xl px-4 py-3 text-sm mb-4 animate-fade-in"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171" }}>
                {genError}
              </div>
            )}

            {generating && (
              <div className="rounded-2xl p-6 animate-fade-in"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <div className="flex justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: "#c084fc" }}>Composing your track...</span>
                  <span className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{Math.round(genProgress)}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${genProgress}%`, background: "linear-gradient(90deg, #a855f7, #06b6d4)" }} />
                </div>
                <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {genProgress < 30 ? "Analyzing prompt..." : genProgress < 60 ? "Composing melody..." : genProgress < 85 ? "Arranging instruments..." : "Finalizing mix..."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* LIBRARY VIEW */}
        {view === "library" && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-mono font-bold text-xl">Your Tracks</h1>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{tracks.length} tracks</span>
            </div>

            {tracks.length === 0 ? (
              <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.15)" }}>
                <div className="text-4xl mb-3">♪</div>
                <p>No tracks yet. Create your first one!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tracks.map((t) => (
                  <TrackCard key={t.id} track={t} onSelect={(tr) => {
                    setSelectedTrack(tr);
                    setRemixSuggestions([]);
                    setShareUrl(null);
                  }} isSelected={selectedTrack?.id === t.id} />
                ))}
              </div>
            )}

            {/* Detail Panel */}
            {selectedTrack && (
              <div className="mt-7 rounded-2xl p-6 animate-fade-in"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-mono font-bold text-lg">{selectedTrack.title}</h2>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {selectedTrack.genre} · {selectedTrack.mood} · {formatTime(selectedTrack.duration_seconds || 0)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleShare(selectedTrack)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                      Share
                    </button>
                    <button onClick={() => loadRemixSuggestions(selectedTrack)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>
                      Remix
                    </button>
                    <button onClick={() => handleDelete(selectedTrack)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.6)" }}>
                      Delete
                    </button>
                  </div>
                </div>

                {shareUrl && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4" }}>
                    Link copied! {shareUrl}
                  </div>
                )}

                {selectedTrack.description && (
                  <p className="text-sm italic mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>{selectedTrack.description}</p>
                )}

                {selectedTrack.lyrics && (
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "rgba(255,255,255,0.2)" }}>Lyrics</label>
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-xl"
                      style={{ color: "rgba(255,255,255,0.45)", background: "rgba(0,0,0,0.3)" }}>
                      {selectedTrack.lyrics}
                    </pre>
                  </div>
                )}

                {selectedTrack.tags && selectedTrack.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTrack.tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-[11px]"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Remix suggestions */}
                {remixSuggestions.length > 0 && (
                  <div className="mt-5">
                    <label className="block text-[11px] font-semibold uppercase tracking-widest mb-3"
                      style={{ color: "rgba(255,255,255,0.2)" }}>Remix Directions</label>
                    <div className="flex flex-col gap-2">
                      {remixSuggestions.map((s, i) => (
                        <button key={i} className="text-left px-4 py-3 rounded-xl text-sm transition-all"
                          style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.1)", color: "rgba(255,255,255,0.6)" }}
                          onClick={() => { setPrompt(s); setView("create"); }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <AudioPlayerBar />
    </div>
  );
}
