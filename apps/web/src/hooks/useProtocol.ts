"use client";

import { useWalletStore } from "@/store/useWalletStore";
import { VENUE_ADDRESS, RLUSD_ISSUER, MPT_ISSUANCE_ID } from "@/lib/protocolConfig";
import { authenticateWallet, mockDidAuthProvider } from "@sdk/oracle/mockDidVerifier";
import { claimTicket } from "@sdk/methods/claimTicket";
import { generateTicketQr } from "@sdk/methods/redeemTicket";
import { returnTicket } from "@sdk/methods/returnTicket";
import type { WalletDidAuth, DidAuthProvider, AuthenticateWalletInput, VerifyDidInput, DidVerificationResult } from "@sdk/oracle/mockDidVerifier";
import type { BuyGroupTicketResult } from "@sdk/methods/buyGroupTicket";
import type { ClaimTicketResult } from "@sdk/methods/claimTicket";
import type { GenerateTicketQrResult, TicketQrPayload } from "@sdk/methods/redeemTicket";
import type { ReturnTicketResult } from "@sdk/methods/returnTicket";

export type { WalletDidAuth };

export type BuyParams = {
  recipients: string[];
  amountRlusd: number;
  eventId: string;
};

// crypto.subtle is only available in secure contexts (HTTPS / localhost).
function hasCryptoSubtle(): boolean {
  try {
    return typeof globalThis.crypto?.subtle?.digest === "function";
  } catch {
    return false;
  }
}

function makeFallbackToken(wallet: string): string {
  return `fallback_${wallet.slice(1, 9)}_${Date.now().toString(36)}`;
}

function makeFallbackAuth(wallet: string): WalletDidAuth {
  const now = new Date();
  const token = makeFallbackToken(wallet);
  return {
    schemaVersion: 1,
    subjectType: "human-to-wallet",
    wallet,
    provider: "mock-phone-proof",
    subjectIdHash: token,
    verifiedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    authToken: token,
  };
}

const fallbackAuthProvider: DidAuthProvider = {
  authenticateWallet: async (input: AuthenticateWalletInput) =>
    makeFallbackAuth(input.wallet),

  verifyWallet: async ({ wallet, artifact }: VerifyDidInput): Promise<DidVerificationResult> => {
    if (!artifact)
      return { wallet, verified: false, provider: "mock-phone-proof", reason: "No DID artifact." };
    if (artifact.wallet !== wallet)
      return { wallet, verified: false, provider: artifact.provider, reason: "Wallet mismatch." };
    if (new Date(artifact.expiresAt).getTime() < Date.now())
      return { wallet, verified: false, provider: artifact.provider, reason: "Artifact expired." };
    return { wallet, verified: true, provider: artifact.provider, artifact };
  },
};

function getAuthProvider(): DidAuthProvider {
  return hasCryptoSubtle() ? mockDidAuthProvider : fallbackAuthProvider;
}

function buildFallbackQr(
  ticketId: string,
  wallet: string,
  auth: WalletDidAuth
): GenerateTicketQrResult {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90_000);
  const nonce = Math.random().toString(16).slice(2, 18);
  const payload: TicketQrPayload = {
    schemaVersion: 1,
    purpose: "ticket-redemption",
    ticketId,
    wallet,
    venueId: VENUE_ADDRESS,
    issuanceId: MPT_ISSUANCE_ID,
    didProvider: auth.provider,
    didToken: auth.authToken,
    nonce,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    qrHash: `fallback_${nonce}`,
  };
  return { payload, qrCodeText: JSON.stringify(payload) };
}

export function useProtocol() {
  const { walletAddress, didAuth, setWalletAddress, setDidAuth, disconnect } = useWalletStore();
  const authProvider = getAuthProvider();

  async function connectWallet(address: string): Promise<WalletDidAuth> {
    let auth: WalletDidAuth;
    if (hasCryptoSubtle()) {
      auth = await authenticateWallet({ wallet: address });
    } else {
      auth = makeFallbackAuth(address);
    }
    setWalletAddress(address);
    setDidAuth(auth);
    return auth;
  }

  async function buy(params: BuyParams): Promise<BuyGroupTicketResult> {
    if (!walletAddress) throw new Error("Wallet not connected.");
    const res = await fetch("/api/devnet/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerWallet: walletAddress,
        recipients: params.recipients,
        amountRlusd: params.amountRlusd,
        eventId: params.eventId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Purchase failed." }));
      throw new Error((err as { error?: string }).error ?? "Purchase failed.");
    }
    return res.json() as Promise<BuyGroupTicketResult>;
  }

  async function getClaims(): Promise<any[]> {
    if (!walletAddress) return [];
    const res = await fetch(`/api/devnet/claims?wallet=${walletAddress}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.claims || [];
  }

  async function claim(claimId: string): Promise<any> {
    if (!walletAddress) throw new Error("Wallet not connected.");
    const res = await fetch("/api/devnet/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimId,
        wallet: walletAddress,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Claim failed." }));
      throw new Error((err as { error?: string }).error ?? "Claim failed.");
    }
    return res.json();
  }

  async function generateQr(ticketId: string): Promise<GenerateTicketQrResult> {
    if (!walletAddress) throw new Error("Wallet not connected.");
    if (!didAuth) throw new Error("Authentication required to generate QR code.");
    if (!hasCryptoSubtle()) {
      return buildFallbackQr(ticketId, walletAddress, didAuth);
    }
    return generateTicketQr({
      ticketId,
      wallet: walletAddress,
      venueId: VENUE_ADDRESS,
      issuanceId: MPT_ISSUANCE_ID,
      didAuth,
      ttlMs: 90_000,
    });
  }

  async function doReturnTicket(ticketId: string, eventId?: string): Promise<any> {
    if (!walletAddress) throw new Error("Wallet not connected.");
    const res = await fetch("/api/devnet/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: walletAddress,
        ticketId,
        venueId: VENUE_ADDRESS,
        eventId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Return failed." }));
      throw new Error((err as { error?: string }).error ?? "Return failed.");
    }
    return res.json();
  }

  async function joinWaitlist(venueId: string): Promise<any> {
    if (!walletAddress) throw new Error("Wallet not connected.");
    const freshAuth = hasCryptoSubtle()
      ? await authenticateWallet({ wallet: walletAddress })
      : makeFallbackAuth(walletAddress);
    const res = await fetch("/api/devnet/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: walletAddress,
        venueId,
        didAuth: freshAuth,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Waitlist join failed." }));
      throw new Error((err as { error?: string }).error ?? "Waitlist join failed.");
    }
    return res.json();
  }

  async function getEventState(eventId: string): Promise<any> {
    const res = await fetch(`/api/devnet/event-state?eventId=${eventId}`);
    if (!res.ok) return null;
    return res.json();
  }

  async function getMyWaitlistStatus(): Promise<any[]> {
    if (!walletAddress) return [];
    const res = await fetch(`/api/devnet/waitlist/my-status?wallet=${walletAddress}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries || [];
  }

  return {
    walletAddress,
    didAuth,
    isAuthenticated: !!didAuth,
    connectWallet,
    disconnectWallet: disconnect,
    buy,
    getClaims,
    claim,
    generateQr,
    returnTicket: doReturnTicket,
    joinWaitlist,
    getEventState,
    getMyWaitlistStatus,
  };
}
