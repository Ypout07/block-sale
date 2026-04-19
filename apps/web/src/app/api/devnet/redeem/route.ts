import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { isAlreadyRedeemed, markRedeemed } from "@/lib/redemptionStore";

type QrPayload = {
  schemaVersion: number;
  purpose: string;
  ticketId: string;
  wallet: string;
  venueId: string;
  issuanceId: string;
  didProvider: string;
  didToken: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  qrHash: string;
};

function buildHash(p: Omit<QrPayload, "qrHash">): string {
  const combined = [
    String(p.schemaVersion),
    p.purpose,
    p.ticketId,
    p.wallet,
    p.venueId,
    p.issuanceId,
    p.didProvider,
    p.didToken,
    p.nonce,
    p.issuedAt,
    p.expiresAt,
  ].join("|");
  return createHash("sha256").update(combined).digest("hex");
}

function validatePayload(raw: unknown): QrPayload {
  const p = raw as Partial<QrPayload>;
  if (
    p.schemaVersion !== 1 ||
    p.purpose !== "ticket-redemption" ||
    typeof p.ticketId !== "string" ||
    typeof p.wallet !== "string" ||
    typeof p.venueId !== "string" ||
    typeof p.issuanceId !== "string" ||
    typeof p.didProvider !== "string" ||
    typeof p.didToken !== "string" ||
    typeof p.nonce !== "string" ||
    typeof p.issuedAt !== "string" ||
    typeof p.expiresAt !== "string" ||
    typeof p.qrHash !== "string"
  ) {
    throw new Error("Malformed QR payload.");
  }
  return p as QrPayload;
}

export async function POST(req: NextRequest) {
  let body: { qrCodeText: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body.qrCodeText);
  } catch {
    return NextResponse.json({ error: "QR text is not valid JSON." }, { status: 400 });
  }

  let payload: QrPayload;
  try {
    payload = validatePayload(raw);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const expectedHash = buildHash(payload);
  if (expectedHash !== payload.qrHash) {
    return NextResponse.json({ error: "Hash mismatch — QR has been tampered with." }, { status: 400 });
  }

  const now = Date.now();
  if (new Date(payload.expiresAt).getTime() < now) {
    return NextResponse.json({ error: "QR code has expired." }, { status: 400 });
  }

  const existing = isAlreadyRedeemed(payload.ticketId);
  if (existing) {
    return NextResponse.json(
      { error: `Ticket already redeemed at ${existing.redeemedAt}.` },
      { status: 409 }
    );
  }

  markRedeemed({
    ticketId: payload.ticketId,
    wallet: payload.wallet,
    venueId: payload.venueId,
    issuanceId: payload.issuanceId,
    redeemedAt: new Date().toISOString(),
    redemptionHash: expectedHash,
  });

  return NextResponse.json({
    valid: true,
    ticketId: payload.ticketId,
    wallet: payload.wallet,
    venueId: payload.venueId,
    issuanceId: payload.issuanceId,
    redeemedAt: new Date().toISOString(),
    redemptionHash: expectedHash,
  });
}
