import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { getNextWaitlistEntry, markWaitlistAllocated } from "@/lib/waitlistStore";
import { addPendingClaim } from "@/lib/claimStore";
import { incrementTickets } from "@/lib/eventStore";
import { markPurchaseReturned, addPurchaseRecord } from "@/lib/purchaseStore";
import { ALL_EVENTS } from "@/data/events";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };

const VENUE_ADDRESS = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";
const RLUSD_ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

const DEMO_SEEDS: Record<string, string> = {
  rDa3E72iujUJciri1B8djcmowVsuNDu4QT: "sEd77UAry5NZshnbLwf9pwU3pscTDf8",
  rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS: "sEdViyntgnVLEaerZG2vthtbk5MFKQM",
  rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z: "sEd77gp3s7HHFNF34Xqv6Km9BMfpwp2",
};

async function submitTx(
  client: Client,
  wallet: Wallet,
  tx: Record<string, unknown>
): Promise<any> {
  const prepared = await client.autofill(tx as Parameters<typeof client.autofill>[0]);
  const signed = wallet.sign(prepared as Parameters<typeof wallet.sign>[0]);
  const result = await client.submitAndWait(signed.tx_blob);
  return result.result;
}

export async function POST(req: NextRequest) {
  const { wallet, ticketId, venueId, eventId } = await req.json();

  const client = new Client(DEVNET_URL, CLIENT_OPTIONS);
  try {
    await client.connect();

    const userSeed = DEMO_SEEDS[wallet];
    const venueSeed = DEMO_SEEDS[VENUE_ADDRESS];

    if (!userSeed || !venueSeed) {
      return NextResponse.json({ error: "Demo seeds missing for return." }, { status: 400 });
    }

    // 1. Ticket Return (User -> Venue)
    await submitTx(client, Wallet.fromSeed(userSeed), {
      TransactionType: "Payment",
      Account: wallet,
      Destination: VENUE_ADDRESS,
      Amount: { mpt_issuance_id: MPT_ISSUANCE_ID, value: "1" },
    });

    // 2. Refund (Venue -> User)
    const event = ALL_EVENTS.find(e => e.id === eventId);
    const refundAmount = event ? event.price.toString() : "100";
    
    await submitTx(client, Wallet.fromSeed(venueSeed), {
      TransactionType: "Payment",
      Account: VENUE_ADDRESS,
      Destination: wallet,
      Amount: { currency: "USD", issuer: RLUSD_ISSUER, value: refundAmount },
    });

    // 3. AUTO-TRIGGER WAITLIST
    // Use the eventId to find the correct waitlist
    const waitlistKey = eventId || VENUE_ADDRESS;
    const nextEntry = getNextWaitlistEntry(waitlistKey);
    
    if (nextEntry) {
      console.log(`Waitlist fulfillment: Found entry for ${nextEntry.wallet} on event ${waitlistKey}`);
      const claimId = `wl_claim_${Date.now()}`;
      addPendingClaim({
        claimId,
        venueId: waitlistKey,
        buyerAddress: VENUE_ADDRESS,
        recipientWallet: nextEntry.wallet,
        amountRlusd: refundAmount,
        status: "pending_authorization",
        createdAt: new Date().toISOString(),
        issuanceId: MPT_ISSUANCE_ID,
      });
      addPurchaseRecord({
        purchaseId: claimId,
        buyerWallet: VENUE_ADDRESS,
        recipientWallet: nextEntry.wallet,
        eventId: waitlistKey,
        purchasedAt: new Date().toISOString(),
        status: "pending_claim",
        claimId,
      });
      markWaitlistAllocated(nextEntry.waitlistId);
    } else if (eventId) {
      // If no one is on waitlist, put ticket back into pool
      incrementTickets(eventId);
    }

    markPurchaseReturned(ticketId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}
