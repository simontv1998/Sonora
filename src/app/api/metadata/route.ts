import { NextRequest, NextResponse } from "next/server";
import { generateMetadata } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { prompt, genre, mood, isInstrumental } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const metadata = await generateMetadata({
      prompt,
      genre,
      mood,
      isInstrumental,
    });

    return NextResponse.json(metadata);
  } catch (error: any) {
    console.error("Metadata error:", error);
    return NextResponse.json(
      { error: error.message || "Metadata generation failed" },
      { status: 500 }
    );
  }
}
