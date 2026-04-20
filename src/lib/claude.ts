import Anthropic from "@anthropic-ai/sdk";
import type { MetadataResponse } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are a music production AI assistant. You help generate creative metadata for AI-composed songs. Always respond with ONLY valid JSON — no markdown, no backticks, no preamble.`;

export async function generateMetadata(params: {
  prompt: string;
  genre?: string;
  mood?: string;
  isInstrumental?: boolean;
}): Promise<MetadataResponse> {
  const userMsg = [
    `Generate metadata for a song with this description: "${params.prompt}"`,
    params.genre && `Genre: ${params.genre}`,
    params.mood && `Mood: ${params.mood}`,
    "",
    "Return JSON with:",
    '- "title": creative song title (2-5 words)',
    `- "lyrics": ${params.isInstrumental ? "null" : "8-16 lines of lyrics matching the mood, with \\n line breaks"}`,
    '- "description": one sentence describing the production style and sound',
    '- "tags": array of 3-6 descriptive tags (e.g. ["dreamy", "synth", "slow-burn"])',
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as MetadataResponse;
}

export async function generateRemixSuggestions(params: {
  originalTitle: string;
  originalPrompt: string;
  genre?: string;
}): Promise<{ suggestions: string[] }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Given a song titled "${params.originalTitle}" described as "${params.originalPrompt}" (genre: ${params.genre || "various"}), suggest 4 creative remix/variation directions. Return JSON: { "suggestions": ["description 1", ...] }. Each suggestion should be a short prompt (10-20 words) describing a different musical direction.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
