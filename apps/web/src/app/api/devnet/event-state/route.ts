import { NextRequest, NextResponse } from "next/server";
import { getEventState } from "@/lib/eventStore";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  
  const state = getEventState(eventId);
  return NextResponse.json(state);
}
