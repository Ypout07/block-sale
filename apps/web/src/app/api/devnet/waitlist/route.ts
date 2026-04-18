import { NextRequest, NextResponse } from "next/server";
import { addWaitlistEntry } from "@/lib/waitlistStore";

export async function POST(req: NextRequest) {
  const { wallet, venueId } = await req.json();

  if (!wallet || !venueId) {
    return NextResponse.json({ error: "Missing wallet or venueId" }, { status: 400 });
  }

  const waitlistId = `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  addWaitlistEntry({
    waitlistId,
    venueId,
    wallet,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, waitlistId });
}
