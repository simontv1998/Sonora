import Replicate from "replicate";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

// Meta MusicGen — text-to-music
const MUSICGEN_MODEL = "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedbbe";

interface MusicGenInput {
  prompt: string;
  duration?: number;          // 1–30 seconds
  temperature?: number;       // 0–1, default 1
  top_k?: number;             // default 250
  top_p?: number;             // default 0
  continuation?: boolean;
  continuation_start?: number;
  continuation_end?: number;
  normalization_strategy?: "loudness" | "clip" | "peak" | "rms";
  output_format?: "wav" | "mp3";
}

export async function generateMusic(params: {
  prompt: string;
  genre?: string;
  mood?: string;
  duration?: number;
}): Promise<{ audioUrl: string; predictionId: string }> {
  // Build a rich prompt from user input + genre/mood
  const parts = [params.prompt];
  if (params.genre) parts.push(`Genre: ${params.genre}`);
  if (params.mood) parts.push(`Mood: ${params.mood}`);
  const fullPrompt = parts.join(". ");

  const input: MusicGenInput = {
    prompt: fullPrompt,
    duration: Math.min(params.duration || 15, 30),
    temperature: 1,
    top_k: 250,
    output_format: "mp3",
    normalization_strategy: "loudness",
  };

  const prediction = await replicate.predictions.create({
    version: MUSICGEN_MODEL.split(":")[1],
    input,
  });

  // Poll until terminal state, bail after 60 attempts (~2 min)
  let result = prediction;
  let attempts = 0;
  while (result.status !== "succeeded" && result.status !== "failed") {
    if (++attempts > 60) throw new Error("MusicGen timed out after 2 minutes");
    await new Promise((r) => setTimeout(r, 2000));
    result = await replicate.predictions.get(result.id);
  }

  if (result.status === "failed") {
    throw new Error(`MusicGen failed: ${result.error}`);
  }

  const audioUrl = typeof result.output === "string"
    ? result.output
    : Array.isArray(result.output)
      ? result.output[0]
      : null;

  if (!audioUrl) throw new Error("MusicGen returned no audio URL");

  return { audioUrl, predictionId: result.id };
}

export async function generateRemix(params: {
  originalPrompt: string;
  variationPrompt: string;
  genre?: string;
  mood?: string;
  duration?: number;
}): Promise<{ audioUrl: string; predictionId: string }> {
  const remixPrompt = `Variation of: ${params.originalPrompt}. New direction: ${params.variationPrompt}`;
  return generateMusic({
    prompt: remixPrompt,
    genre: params.genre,
    mood: params.mood,
    duration: params.duration,
  });
}
