import { NextRequest, NextResponse } from "next/server";
import { Client } from "xrpl";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };
const RLUSD_ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !wallet.startsWith("r")) {
    return NextResponse.json({ error: "Missing or invalid wallet param." }, { status: 400 });
  }

  const client = new Client(DEVNET_URL, CLIENT_OPTIONS);
  try {
    await client.connect();
    const res = await client.request({ command: "account_lines", account: wallet });
    const line = res.result.lines.find(
      (l: { currency: string; account: string }) => l.currency === "USD" && l.account === RLUSD_ISSUER
    );
    const balance = line ? parseFloat(line.balance).toFixed(2) : "0.00";
    return NextResponse.json({ balanceRlusd: balance });
  } catch {
    return NextResponse.json({ balanceRlusd: "0.00" });
  } finally {
    await client.disconnect();
  }
}
