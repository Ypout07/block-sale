import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { Protocol } from "@sdk/index";
import type { DidAuthProvider, WalletDidAuth } from "@sdk/index";
import type { VerifyDidInput } from "@sdk/oracle/mockDidVerifier";
import { addWaitlistEntry } from "@/lib/waitlistStore";

const laxAuthProvider: DidAuthProvider = {
  authenticateWallet: async (input) => {
    const now = new Date();
    return {
      schemaVersion: 1,
      subjectType: "human-to-wallet",
      wallet: input.wallet,
      provider: "mock-phone-proof",
      subjectIdHash: input.wallet,
      verifiedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      authToken: input.wallet,
    } satisfies WalletDidAuth;
  },
  verifyWallet: async ({ wallet, artifact }: VerifyDidInput) => {
    if (!artifact) return { wallet, verified: false, provider: "mock-phone-proof", reason: "No artifact." };
    if (artifact.wallet !== wallet) return { wallet, verified: false, provider: artifact.provider, reason: "Wallet mismatch." };
    if (new Date(artifact.expiresAt).getTime() < Date.now()) return { wallet, verified: false, provider: artifact.provider, reason: "Artifact expired." };
    return { wallet, verified: true, provider: artifact.provider, artifact };
  },
};

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };
const VENUE_ADDRESS = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const RLUSD_ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";
const DEPOSIT_DROPS = "2000000";

const DEMO_SEEDS: Record<string, string> = {
  rDa3E72iujUJciri1B8djcmowVsuNDu4QT: "sEd77UAry5NZshnbLwf9pwU3pscTDf8",
  rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS: "sEdViyntgnVLEaerZG2vthtbk5MFKQM",
  rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z: "sEd77gp3s7HHFNF34Xqv6Km9BMfpwp2",
};

export async function POST(req: NextRequest) {
  const { wallet, venueId: eventId, didAuth } = await req.json();

  if (!wallet || !eventId) {
    return NextResponse.json({ error: "Missing wallet or venueId" }, { status: 400 });
  }
  if (!didAuth) {
    return NextResponse.json({ error: "DID authentication required." }, { status: 400 });
  }

  const seed = DEMO_SEEDS[wallet];
  if (!seed) {
    return NextResponse.json({ error: "No seed for demo wallet." }, { status: 400 });
  }

  const client = new Client(DEVNET_URL, CLIENT_OPTIONS);
  try {
    await client.connect();
    const walletObj = Wallet.fromSeed(seed);
    const protocol = new Protocol(VENUE_ADDRESS, RLUSD_ISSUER, MPT_ISSUANCE_ID);

    const result = await protocol.joinWaitlist({
      venueId: VENUE_ADDRESS,
      eventId,
      wallet,
      depositDrops: DEPOSIT_DROPS,
      didAuth,
      runtime: {
        authProvider: laxAuthProvider,
        submitEscrow: async (escrowTx) => {
          const prepared = await client.autofill(escrowTx as Parameters<typeof client.autofill>[0]);
          const signed = walletObj.sign(prepared as Parameters<typeof walletObj.sign>[0]);
          const res = await client.submitAndWait(signed.tx_blob);
          return res.result;
        },
        persistWaitlistEntry: async (entry) => {
          addWaitlistEntry(entry);
        },
      },
    });

    return NextResponse.json({ success: true, waitlistId: result.waitlistId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}
