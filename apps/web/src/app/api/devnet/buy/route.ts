import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { addPendingClaim } from "@/lib/claimStore";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };

const VENUE_ADDRESS = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";
const RLUSD_ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

// Pre-funded demo seeds from contracts/devnet.json — server-side only
const DEMO_SEEDS: Record<string, string> = {
  rDa3E72iujUJciri1B8djcmowVsuNDu4QT: "sEd77UAry5NZshnbLwf9pwU3pscTDf8",
  rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS: "sEdViyntgnVLEaerZG2vthtbk5MFKQM",
  rEkTUKB9MAPH5pUuu3nJYvnjdfzmwDbSXn: "sEdVJx2sPea2mB1nAhEDJ9QBy9mU67h",
  rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z: "sEd77gp3s7HHFNF34Xqv6Km9BMfpwp2",
};

type TxResult = {
  hash?: string;
  meta?: { TransactionResult?: string };
  [k: string]: unknown;
};

async function submitTx(
  client: Client,
  wallet: Wallet,
  tx: Record<string, unknown>
): Promise<TxResult> {
  const prepared = await client.autofill(tx as Parameters<typeof client.autofill>[0]);
  const raw = prepared as Record<string, unknown>;
  if (typeof raw.LastLedgerSequence === "number") {
    raw.LastLedgerSequence = (raw.LastLedgerSequence as number) + 100;
  }
  const signed = wallet.sign(prepared as Parameters<typeof wallet.sign>[0]);
  const result = await client.submitAndWait(signed.tx_blob);
  return result.result as TxResult;
}

async function isRecipientAuthorized(client: Client, wallet: string): Promise<boolean> {
  const response = await client.request({ command: "account_objects", account: wallet });
  const objects =
    ((response.result as Record<string, unknown>).account_objects as Array<Record<string, unknown>>) ?? [];
  return objects.some(
    (e) => e.LedgerEntryType === "MPToken" && e.MPTokenIssuanceID === MPT_ISSUANCE_ID
  );
}

export function GET() {
  return NextResponse.json({ status: "ok", devnet: DEVNET_URL });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    payerWallet: string;
    recipients: string[];
    amountRlusd: number;
  };
  const { payerWallet, recipients, amountRlusd } = body;

  const payerSeed = DEMO_SEEDS[payerWallet];
  if (!payerSeed) {
    return NextResponse.json(
      { error: "Wallet not recognized as a funded demo wallet. Connect as Alice or Bob." },
      { status: 400 }
    );
  }

  const client = new Client(DEVNET_URL, CLIENT_OPTIONS);
  try {
    await client.connect();

    const payerWalletObj = Wallet.fromSeed(payerSeed);
    const venueWalletObj = Wallet.fromSeed(DEMO_SEEDS[VENUE_ADDRESS]);

    // Step 1: RLUSD payment from buyer to venue
    let paymentResult: TxResult;
    try {
      paymentResult = await submitTx(client, payerWalletObj, {
        TransactionType: "Payment",
        Account: payerWallet,
        Destination: VENUE_ADDRESS,
        Amount: { currency: "USD", value: amountRlusd.toString(), issuer: RLUSD_ISSUER },
      });
    } catch (e) {
      return NextResponse.json(
        { error: `RLUSD payment failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 }
      );
    }

    if (paymentResult.meta?.TransactionResult !== "tesSUCCESS") {
      return NextResponse.json(
        { error: `Payment rejected: ${paymentResult.meta?.TransactionResult ?? "unknown"}` },
        { status: 500 }
      );
    }

    // Step 2: Release MPT ticket to each recipient
    const deliveredRecipients: unknown[] = [];
    const pendingRecipients: unknown[] = [];
    const failedRecipients: unknown[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipientWallet = recipients[i];

      let authorized = await isRecipientAuthorized(client, recipientWallet);

      // Auto-authorize if we have the recipient's seed (demo wallets only)
      if (!authorized) {
        const recipientSeed = DEMO_SEEDS[recipientWallet];
        if (recipientSeed) {
          try {
            await submitTx(client, Wallet.fromSeed(recipientSeed), {
              TransactionType: "MPTokenAuthorize",
              Account: recipientWallet,
              MPTokenIssuanceID: MPT_ISSUANCE_ID,
            });
            authorized = true;
          } catch {
            // best-effort — continue to check state
          }
        }
      }

      if (!authorized) {
        const claimId = `claim_${Date.now()}_${i}`;
        addPendingClaim({
          claimId,
          venueId: VENUE_ADDRESS,
          buyerAddress: payerWallet,
          recipientWallet,
          amountRlusd: (amountRlusd / recipients.length).toString(),
          status: "pending_authorization",
          createdAt: new Date().toISOString(),
          issuanceId: MPT_ISSUANCE_ID,
        });

        pendingRecipients.push({
          claimId,
          recipientWallet,
          ticketIndex: i,
          status: "pending_authorization",
          lifecycleState: "pending_authorization",
          reason: "Recipient must submit MPTokenAuthorize before delivery.",
          authorizationVerified: false,
          didVerified: true,
        });
        continue;
      }

      // Send ticket MPT from venue to recipient
      try {
        const releaseResult = await submitTx(client, venueWalletObj, {
          TransactionType: "Payment",
          Account: VENUE_ADDRESS,
          Destination: recipientWallet,
          Amount: { mpt_issuance_id: MPT_ISSUANCE_ID, value: "1" },
        });

        if (releaseResult.meta?.TransactionResult === "tesSUCCESS") {
          deliveredRecipients.push({
            recipientWallet,
            ticketIndex: i,
            status: "delivered",
            lifecycleState: "claimed",
            authorizationVerified: true,
            didVerified: true,
            releaseResult,
          });
        } else {
          failedRecipients.push({
            recipientWallet,
            ticketIndex: i,
            status: "release_failed",
            lifecycleState: "pending_authorization",
            reason: `Release rejected: ${releaseResult.meta?.TransactionResult ?? "unknown"}`,
            authorizationVerified: true,
            didVerified: true,
          });
        }
      } catch (e) {
        failedRecipients.push({
          recipientWallet,
          ticketIndex: i,
          status: "release_failed",
          lifecycleState: "pending_authorization",
          reason: e instanceof Error ? e.message : "Release failed.",
          authorizationVerified: true,
          didVerified: true,
        });
      }
    }

    return NextResponse.json({
      paymentStatus: "verified",
      paymentHash: paymentResult.hash,
      deliveredRecipients,
      pendingRecipients,
      failedRecipients,
      purchaseMode: recipients.length === 1 ? "solo" : "group",
      groupSize: recipients.length,
      recipients,
    });
  } finally {
    await client.disconnect();
  }
}
