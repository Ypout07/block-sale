import { NextRequest, NextResponse } from "next/server";
import { getPurchasesByWallet } from "@/lib/purchaseStore";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !wallet.startsWith("r")) {
    return NextResponse.json({ error: "Missing or invalid wallet param." }, { status: 400 });
  }
  const purchases = getPurchasesByWallet(wallet);
  return NextResponse.json({ purchases });
}
