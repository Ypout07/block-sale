import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { getNextWaitlistEntry, markWaitlistAllocated } from "@/lib/waitlistStore";
import { addPendingClaim } from "@/lib/claimStore";
import { incrementTickets } from "@/lib/eventStore";
import { markPurchaseReturned, addPurchaseRecord } from "@/lib/purchaseStore";
import { ALL_EVENTS } from "@/data/events";
import { Protocol } from "@sdk/index";

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

    const protocol = new Protocol(VENUE_ADDRESS, RLUSD_ISSUER, MPT_ISSUANCE_ID);
    const didAuth = await protocol.authenticateWallet(wallet);
    
    const returnResult = await protocol.returnTicket({
      venueId: VENUE_ADDRESS,
      wallet: wallet,
      ticketId: ticketId,
      didAuth,
      runtime: {
        loadClaimRecord: async (id) => {
            const event = ALL_EVENTS.find(e => e.id === eventId);
            const refundAmount = event ? event.price.toString() : "100";
            
            return {
                claimId: id,
                paymentTxHash: "mock",
                buyerAddress: wallet,
                recipientWallet: wallet,
                vendorAddress: VENUE_ADDRESS,
                issuanceId: MPT_ISSUANCE_ID,
                ticketIndex: 0,
                amountRlusd: refundAmount,
                currency: "USD",
                issuerAddress: RLUSD_ISSUER,
                status: "claimed",
                createdAt: new Date().toISOString()
            } as any;
        },
        loadNextWaitlistEntry: async (venueIdStr) => {
            const waitlistKey = eventId || VENUE_ADDRESS;
            const nextEntry = getNextWaitlistEntry(waitlistKey);
            if (!nextEntry) return null;
            return {
                waitlistId: nextEntry.waitlistId,
                wallet: nextEntry.wallet,
                venueId: waitlistKey,
            } as any;
        },
        submitReturnBatch: async (batchPlan) => {
            const userWalletObj = Wallet.fromSeed(userSeed);
            const venueWalletObj = Wallet.fromSeed(venueSeed);
            
            const returnTx = batchPlan.transactions.find(t => t.role === "ticket_return")?.tx;
            const refundTx = batchPlan.transactions.find(t => t.role === "refund")?.tx;
            
            let ticketReturnResult: any = null;
            let refundResult: any = null;
            
            if (returnTx) {
                ticketReturnResult = await submitTx(client, userWalletObj, returnTx);
            }
            if (refundTx) {
                refundResult = await submitTx(client, venueWalletObj, refundTx);
            }
            
            return {
                results: {
                    ticket_return: ticketReturnResult,
                    refund: refundResult,
                    waitlist_escrow_finish: null
                }
            };
        },
        updateClaimRecord: async (id, updates) => {
            if (updates.status === "returned") {
                markPurchaseReturned(ticketId); // Use ticketId as in original code
            }
        },
        updateWaitlistEntry: async (waitlistId, updates) => {
            if (updates.status === "allocated") {
                markWaitlistAllocated(waitlistId);
            }
        },
        persistPendingClaim: async (pendingClaim) => {
            const waitlistKey = eventId || VENUE_ADDRESS;
            const claimId = `wl_claim_${Date.now()}`;
            console.log(`Waitlist fulfillment: Found entry for ${pendingClaim.recipientWallet} on event ${waitlistKey}`);
            
            addPendingClaim({
                claimId,
                venueId: waitlistKey,
                eventId: waitlistKey, // manually map the event ID
                buyerAddress: VENUE_ADDRESS,
                recipientWallet: pendingClaim.recipientWallet,
                amountRlusd: pendingClaim.amountRlusd,
                status: "pending_authorization",
                createdAt: new Date().toISOString(),
                issuanceId: MPT_ISSUANCE_ID,
            } as any);
            addPurchaseRecord({
                purchaseId: claimId,
                buyerWallet: VENUE_ADDRESS,
                recipientWallet: pendingClaim.recipientWallet,
                eventId: waitlistKey,
                purchasedAt: new Date().toISOString(),
                status: "pending_claim",
                claimId,
            });
        }
      }
    });

    if (!returnResult.allocatedWaitlistEntry && eventId) {
        incrementTickets(eventId);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}
