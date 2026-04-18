import { NextRequest, NextResponse } from "next/server";
import { Client } from "xrpl";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !wallet.startsWith("r")) {
    return NextResponse.json({ error: "Missing or invalid wallet param." }, { status: 400 });
  }

  const client = new Client(DEVNET_URL, CLIENT_OPTIONS);
  try {
    await client.connect();
    const response = await client.request({ command: "account_objects", account: wallet });
    const objects =
      ((response.result as Record<string, unknown>).account_objects as Array<Record<string, unknown>>) ?? [];

    const ticketToken = objects.find(
      (e) => e.LedgerEntryType === "MPToken" && e.MPTokenIssuanceID === MPT_ISSUANCE_ID
    );

    const amount = ticketToken ? Number(String(ticketToken.MPTAmount ?? "0")) : 0;
    return NextResponse.json({ wallet, mptIssuanceId: MPT_ISSUANCE_ID, ticketCount: amount });
  } finally {
    await client.disconnect();
  }
}
