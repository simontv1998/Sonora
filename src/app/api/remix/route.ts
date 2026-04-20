import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { generateRemix } from "@/lib/replicate";
import { generateMetadata, generateRemixSuggestions } from "@/lib/claude";

export const maxDuration = 120;

// GET: Get remix suggestions for a track
export async function GET(req: NextRequest) {
  try {
    const trackId = req.nextUrl.searchParams.get("trackId");
    if (!trackId) {
      return NextResponse.json({ error: "trackId required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: track } = await supabase
      .from("tracks")
      .select("title, prompt, genre")
      .eq("id", trackId)
      .single();

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const suggestions = await generateRemixSuggestions({
      originalTitle: track.title,
      originalPrompt: track.prompt,
      genre: track.genre || undefined,
    });

    return NextResponse.json(suggestions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Generate a remix
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parentTrackId, variationPrompt, duration = 15 } = await req.json();

    // Fetch parent track
    const { data: parent } = await supabase
      .from("tracks")
      .select("*")
      .eq("id", parentTrackId)
      .single();

    if (!parent) {
      return NextResponse.json({ error: "Parent track not found" }, { status: 404 });
    }

    // Create pending remix record
    const { data: track } = await supabase
      .from("tracks")
      .insert({
        user_id: user.id,
        title: "Remixing...",
        prompt: variationPrompt,
        genre: parent.genre,
        mood: parent.mood,
        parent_track_id: parentTrackId,
        is_remix: true,
        status: "generating",
      })
      .select()
      .single();

    if (!track) throw new Error("Failed to create remix record");

    try {
      // Generate audio + metadata in parallel
      const [audio, metadata] = await Promise.all([
        generateRemix({
          originalPrompt: parent.prompt,
          variationPrompt,
          genre: parent.genre || undefined,
          mood: parent.mood || undefined,
          duration,
        }),
        generateMetadata({
          prompt: `Remix of "${parent.title}": ${variationPrompt}`,
          genre: parent.genre || undefined,
          mood: parent.mood || undefined,
        }),
      ]);

      // Upload audio
      const audioResponse = await fetch(audio.audioUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioPath = `${user.id}/${track.id}.mp3`;

      await supabase.storage
        .from("tracks")
        .upload(audioPath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

      const {
        data: { publicUrl },
      } = supabase.storage.from("tracks").getPublicUrl(audioPath);

      // Update remix track
      const { data: updatedTrack } = await supabase
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

      return NextResponse.json({ track: updatedTrack });
    } catch (genError: any) {
      await supabase.from("tracks").update({ status: "failed" }).eq("id", track.id);
      throw genError;
    }
  } catch (error: any) {
    console.error("Remix error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
