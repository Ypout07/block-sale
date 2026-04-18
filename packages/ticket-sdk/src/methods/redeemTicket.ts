import {
  mockDidAuthProvider,
  type DidAuthProvider,
  type WalletDidAuth
} from "../oracle/mockDidVerifier.js";
import type { PendingClaimRecord } from "./claimTicket.js";

export type TicketQrPayload = {
  schemaVersion: 1;
  purpose: "ticket-redemption";
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

export type GenerateTicketQrInput = {
  ticketId: string;
  wallet: string;
  venueId: string;
  issuanceId: string;
  didAuth?: WalletDidAuth;
  didToken?: string;
  nonce?: string;
  issuedAt?: Date;
  ttlMs?: number;
};

export type GenerateTicketQrResult = {
  payload: TicketQrPayload;
  qrCodeText: string;
};

export type RedeemTicketRuntime = {
  loadPendingClaim?: (ticketId: string) => Promise<PendingClaimRecord | null> | PendingClaimRecord | null;
  updateClaimRecord?: (
    claimId: string,
    updates: { status: "redeemed"; redeemedAt: string; redemptionHash: string }
  ) => Promise<void> | void;
  authProvider?: DidAuthProvider;
  now?: () => Date;
};

export type RedeemTicketInput = {
  ticketId: string;
  wallet: string;
  venueId: string;
  qrCodeText: string;
  didAuth?: WalletDidAuth;
  runtime?: RedeemTicketRuntime;
};

export type RedeemTicketResult = {
  ticketId: string;
  wallet: string;
  redemptionStatus: "planned" | "redeemed";
  qrPayload: TicketQrPayload;
  didVerification: {
    wallet: string;
    verified: boolean;
    provider: string;
  };
  redemptionHash: string;
};

function iso(date: Date) {
  return date.toISOString();
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildQrHash(input: {
  schemaVersion: 1;
  purpose: "ticket-redemption";
  ticketId: string;
  wallet: string;
  venueId: string;
  issuanceId: string;
  didProvider: string;
  didToken: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}) {
  return sha256Hex(
    [
      String(input.schemaVersion),
      input.purpose,
      input.ticketId,
      input.wallet,
      input.venueId,
      input.issuanceId,
      input.didProvider,
      input.didToken,
      input.nonce,
      input.issuedAt,
      input.expiresAt
    ].join("|")
  );
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function generateTicketQr(input: GenerateTicketQrInput): Promise<GenerateTicketQrResult> {
  if (!input.didAuth) {
    throw new Error("generateTicketQr requires a DID authentication artifact.");
  }

  if (input.didAuth.wallet !== input.wallet) {
    throw new Error("DID authentication artifact does not match the QR wallet.");
  }

  const issuedAt = input.issuedAt ?? new Date();
  const ttlMs = input.ttlMs ?? 60_000;
  const expiresAt = new Date(issuedAt.getTime() + ttlMs);
  const didProvider = input.didAuth.provider;
  const didToken = input.didAuth.authToken;
  const nonce = input.nonce ?? randomNonce();

  const payloadWithoutHash = {
    schemaVersion: 1 as const,
    purpose: "ticket-redemption" as const,
    ticketId: input.ticketId,
    wallet: input.wallet,
    venueId: input.venueId,
    issuanceId: input.issuanceId,
    didProvider,
    didToken,
    nonce,
    issuedAt: iso(issuedAt),
    expiresAt: iso(expiresAt)
  };

  const qrHash = await buildQrHash(payloadWithoutHash);
  const payload: TicketQrPayload = {
    ...payloadWithoutHash,
    qrHash
  };

  return {
    payload,
    qrCodeText: JSON.stringify(payload)
  };
}

function parseQrCodeText(qrCodeText: string): TicketQrPayload {
  const parsed = JSON.parse(qrCodeText) as Partial<TicketQrPayload>;
  if (
    parsed.schemaVersion !== 1 ||
    parsed.purpose !== "ticket-redemption" ||
    typeof parsed.ticketId !== "string" ||
    typeof parsed.wallet !== "string" ||
    typeof parsed.venueId !== "string" ||
    typeof parsed.issuanceId !== "string" ||
    typeof parsed.didProvider !== "string" ||
    typeof parsed.didToken !== "string" ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.issuedAt !== "string" ||
    typeof parsed.expiresAt !== "string" ||
    typeof parsed.qrHash !== "string"
  ) {
    throw new Error("QR code payload is malformed.");
  }

  return parsed as TicketQrPayload;
}

export async function redeemTicket(input: RedeemTicketInput): Promise<RedeemTicketResult> {
  const runtime = input.runtime;
  const qrPayload = parseQrCodeText(input.qrCodeText);

  if (qrPayload.ticketId !== input.ticketId) {
    throw new Error("QR ticket ID does not match the requested ticket.");
  }

  if (qrPayload.wallet !== input.wallet) {
    throw new Error("QR wallet does not match the redeeming wallet.");
  }

  if (qrPayload.venueId !== input.venueId) {
    throw new Error("QR venue ID does not match the scanning venue.");
  }

  const expectedHash = await buildQrHash({
    schemaVersion: qrPayload.schemaVersion,
    purpose: qrPayload.purpose,
    ticketId: qrPayload.ticketId,
    wallet: qrPayload.wallet,
    venueId: qrPayload.venueId,
    issuanceId: qrPayload.issuanceId,
    didProvider: qrPayload.didProvider,
    didToken: qrPayload.didToken,
    nonce: qrPayload.nonce,
    issuedAt: qrPayload.issuedAt,
    expiresAt: qrPayload.expiresAt
  });

  if (expectedHash !== qrPayload.qrHash) {
    throw new Error("QR hash does not match the payload contents.");
  }

  const now = runtime?.now?.() ?? new Date();
  if (new Date(qrPayload.expiresAt).getTime() < now.getTime()) {
    throw new Error("QR code has expired.");
  }

  const claimRecord = await runtime?.loadPendingClaim?.(input.ticketId);
  if (!claimRecord) {
    return {
      ticketId: input.ticketId,
      wallet: input.wallet,
      redemptionStatus: "planned",
      qrPayload,
      didVerification: {
        wallet: input.wallet,
        verified: true,
        provider: qrPayload.didProvider
      },
      redemptionHash: expectedHash
    };
  }

  if (claimRecord.recipientWallet !== input.wallet) {
    throw new Error("Claim record wallet does not match the scanned ticket wallet.");
  }

  if (claimRecord.status !== "claimed") {
    throw new Error(`Ticket ${input.ticketId} is ${claimRecord.status} and cannot be redeemed.`);
  }

  const didVerification = await (runtime?.authProvider ?? mockDidAuthProvider).verifyWallet({
    wallet: input.wallet,
    artifact: input.didAuth
  });

  if (!didVerification.verified) {
    throw new Error(didVerification.reason ?? "DID verification failed for the redeeming wallet.");
  }

  if (!input.didAuth) {
    throw new Error("redeemTicket requires a DID authentication artifact.");
  }

  if (input.didAuth.provider !== qrPayload.didProvider || input.didAuth.authToken !== qrPayload.didToken) {
    throw new Error("DID authentication artifact does not match the QR payload.");
  }

  await runtime?.updateClaimRecord?.(input.ticketId, {
    status: "redeemed",
    redeemedAt: now.toISOString(),
    redemptionHash: expectedHash
  });

  return {
    ticketId: input.ticketId,
    wallet: input.wallet,
    redemptionStatus: "redeemed",
    qrPayload,
    didVerification,
    redemptionHash: expectedHash
  };
}
