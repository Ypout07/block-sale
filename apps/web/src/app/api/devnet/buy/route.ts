import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { addPendingClaim } from "@/lib/claimStore";
import { decrementTickets } from "@/lib/eventStore";
import { addPurchaseRecord } from "@/lib/purchaseStore";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };

const VENUE_ADDRESS = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";
const RLUSD_ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

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
  return result.result as unknown as TxResult;
}

async function isRecipientAuthorized(client: Client, wallet: string): Promise<boolean> {
  const response = await client.request({ command: "account_objects", account: wallet });
  const objects =
    ((response.result as Record<string, unknown>).account_objects as Array<Record<string, unknown>>) ?? [];
  return objects.some(
    (e) => e.LedgerEntryType === "MPToken" && e.MPTokenIssuanceID === MPT_ISSUANCE_ID
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    payerWallet: string;
    recipients: string[];
    amountRlusd: number;
    eventId?: string;
  };
  const { payerWallet, recipients, amountRlusd, eventId } = body;

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

    // Ensure Venue has a trust line for RLUSD and allow rippling
    try {
      const lines = await client.request({ command: "account_lines", account: VENUE_ADDRESS });
      const hasLine = lines.result.lines.some((l: any) => l.currency === "USD" && l.account === RLUSD_ISSUER);
      if (!hasLine) {
        await submitTx(client, venueWalletObj, {
          TransactionType: "TrustSet",
          Account: VENUE_ADDRESS,
          Flags: 0x00020000, // tfClearNoRipple
          LimitAmount: { currency: "USD", issuer: RLUSD_ISSUER, value: "1000000" },
        });
      }
    } catch (e) {
      console.error("Venue trustline setup failed", e);
    }

    // Step 1: Redemption-Issue Bridge (Bypasses Ripple Pathing Errors)
    let paymentResult: TxResult;
    try {
      const issuerWalletObj = Wallet.fromSeed(DEMO_SEEDS[RLUSD_ISSUER] || "sEdTcVsmgfearttgmGVyXipHui29i2K");
      const amountStr = amountRlusd.toString();

      console.log(`LiquidityBridge: Alice redeeming ${amountStr} to Issuer...`);
      // A: Alice -> Issuer (Redemption)
      const redeemTx = await submitTx(client, payerWalletObj, {
        TransactionType: "Payment",
        Account: payerWallet,
        Destination: RLUSD_ISSUER,
        Amount: { currency: "USD", value: amountStr, issuer: RLUSD_ISSUER },
      });

      if (redeemTx.meta?.TransactionResult !== "tesSUCCESS") {
        let msg = `Redemption failed: ${redeemTx.meta?.TransactionResult}`;
        if (redeemTx.meta?.TransactionResult === "tecPATH_PARTIAL" || redeemTx.meta?.TransactionResult === "tecPATH_DRY") {
          msg = `Insufficient RLUSD balance in ${payerWallet}. Current balance must cover ticket price (${amountStr} USD). Use fix_alice.ts or the faucet.`;
        }
        return NextResponse.json(
          { error: msg },
          { status: 500 }
        );
      }

      console.log(`LiquidityBridge: Issuer issuing ${amountStr} to Venue...`);
      // B: Issuer -> Venue (Issuance)
      paymentResult = await submitTx(client, issuerWalletObj, {
        TransactionType: "Payment",
        Account: RLUSD_ISSUER,
        Destination: VENUE_ADDRESS,
        Amount: { currency: "USD", value: amountStr, issuer: RLUSD_ISSUER },
      });

    } catch (e) {
      return NextResponse.json(
        { error: `Liquidity bridge failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 }
      );
    }

    if (paymentResult.meta?.TransactionResult !== "tesSUCCESS") {
      return NextResponse.json(
        { error: `Issuance rejected: ${paymentResult.meta?.TransactionResult ?? "unknown"}` },
        { status: 500 }
      );
    }

    // Step 2: Release MPT ticket to each recipient
    const deliveredRecipients: unknown[] = [];
    const pendingRecipients: unknown[] = [];
    const failedRecipients: unknown[] = [];

    for (let i = 0; i < recipients.length; i++) {
      // Dynamic ticket tracking
      if (eventId) {
        decrementTickets(eventId);
      }

      const recipientWallet = recipients[i];
      let authorized = await isRecipientAuthorized(client, recipientWallet);

      if (recipientWallet !== payerWallet) {
        authorized = false;
      }

      if (!authorized) {
        const claimId = `claim_${Date.now()}_${i}`;
        addPendingClaim({
          claimId,
          venueId: VENUE_ADDRESS,
          eventId: eventId || "12",
          buyerAddress: payerWallet,
          recipientWallet,
          amountRlusd: (amountRlusd / recipients.length).toString(),
          status: "pending_authorization",
          createdAt: new Date().toISOString(),
          issuanceId: MPT_ISSUANCE_ID,
        });
        addPurchaseRecord({
          purchaseId: claimId,
          buyerWallet: payerWallet,
          recipientWallet,
          eventId: eventId || "12",
          purchasedAt: new Date().toISOString(),
          status: "pending_claim",
          claimId,
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

      try {
        const releaseResult = await submitTx(client, venueWalletObj, {
          TransactionType: "Payment",
          Account: VENUE_ADDRESS,
          Destination: recipientWallet,
          Amount: { mpt_issuance_id: MPT_ISSUANCE_ID, value: "1" },
        });

        if (releaseResult.meta?.TransactionResult === "tesSUCCESS") {
          const purchaseId = `purchase_${Date.now()}_${i}`;
          addPurchaseRecord({
            purchaseId,
            buyerWallet: payerWallet,
            recipientWallet,
            eventId: eventId || "12",
            purchasedAt: new Date().toISOString(),
            status: "delivered",
          });
          deliveredRecipients.push({ purchaseId, recipientWallet, ticketIndex: i, status: "delivered" });
        } else {
          failedRecipients.push({ recipientWallet, ticketIndex: i, status: "release_failed" });
        }
      } catch (e) {
        failedRecipients.push({ recipientWallet, ticketIndex: i, status: "release_failed" });
      }
    }

    return NextResponse.json({
      paymentStatus: "verified",
      paymentHash: paymentResult.hash,
      deliveredRecipients,
      pendingRecipients,
      failedRecipients,
      eventId: eventId || "12",
    });
  } finally {
    await client.disconnect();
  }
}
