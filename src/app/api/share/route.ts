import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { nanoid } from "nanoid";

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

    const { trackId } = await req.json();

    // Check ownership
    const { data: track } = await supabase
      .from("tracks")
      .select("id, user_id, share_slug, is_public")
      .eq("id", trackId)
      .single();

    if (!track || track.user_id !== user.id) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // If already shared, return existing slug
    if (track.share_slug) {
      return NextResponse.json({
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/track/${track.share_slug}`,
        slug: track.share_slug,
      });
    }

    // Generate share slug and make public
    const slug = nanoid(10);
    await supabase
      .from("tracks")
      .update({ share_slug: slug, is_public: true })
      .eq("id", trackId);

    return NextResponse.json({
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/track/${slug}`,
      slug,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
