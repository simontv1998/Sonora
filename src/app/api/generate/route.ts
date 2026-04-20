import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { generateMusic } from "@/lib/replicate";
import { generateMetadata } from "@/lib/claude";
import type { GenerateRequest } from "@/lib/types";

export const maxDuration = 120; // Allow up to 2 min for audio generation

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get authenticated user from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: GenerateRequest = await req.json();
    const { prompt, genre, mood, duration = 15 } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Create a pending track record
    const { data: track, error: insertError } = await supabase
      .from("tracks")
      .insert({
        user_id: user.id,
        title: "Generating...",
        prompt,
        genre,
        mood,
        status: "generating",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Run Claude metadata + Replicate audio in parallel
    const [metadata, audio] = await Promise.all([
      generateMetadata({ prompt, genre: genre || undefined, mood: mood || undefined }),
      generateMusic({ prompt, genre: genre || undefined, mood: mood || undefined, duration }),
    ]);

    // 3. Download audio from Replicate and upload to Supabase Storage
    const audioResponse = await fetch(audio.audioUrl);
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioPath = `${user.id}/${track.id}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(audioPath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("tracks").getPublicUrl(audioPath);

    // 4. Update track with metadata and audio URL
    const { data: updatedTrack, error: updateError } = await supabase
      .from("tracks")
      .update({
        title: metadata.title,
        lyrics: metadata.lyrics,
        description: metadata.description,
        tags: metadata.tags,
        audio_url: publicUrl,
        duration_seconds: duration,
        replicate_prediction_id: audio.predictionId,
        status: "completed",
      })
      .eq("id", track.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ track: updatedTrack });
  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error.message || "Generation failed" },
      { status: 500 }
    );
  }
}
