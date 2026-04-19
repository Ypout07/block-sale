import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { getPendingClaims, markClaimed } from "@/lib/claimStore";
import { markPurchaseClaimed } from "@/lib/purchaseStore";
import { Protocol } from "@sdk/index";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const CLIENT_OPTIONS = { connectionTimeout: 20000 };

const VENUE_ADDRESS = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";

const DEMO_SEEDS: Record<string, string> = {
  rDa3E72iujUJciri1B8djcmowVsuNDu4QT: "sEd77UAry5NZshnbLwf9pwU3pscTDf8",
  rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS: "sEdViyntgnVLEaerZG2vthtbk5MFKQM",
  rEkTUKB9MAPH5pUuu3nJYvnjdfzmwDbSXn: "sEdVJx2sPea2mB1nAhEDJ9QBy9mU67h",
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

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet param" }, { status: 400 });
  }
  const claims = getPendingClaims(wallet);
  return NextResponse.json({ claims });
}

export async function POST(req: NextRequest) {
  const { claimId, wallet: recipientWallet } = await req.json();
  
  const claims = getPendingClaims(recipientWallet);
  const claim = claims.find(c => c.claimId === claimId);
  
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.status === "claimed") {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 });
  }

  const client = new Client(DEVNET_URL, CLIENT_OPTIONS);
  try {
    await client.connect();

    const recipientSeed = DEMO_SEEDS[recipientWallet];
    if (!recipientSeed) {
        return NextResponse.json({ error: "Recipient must be a demo wallet for auto-authorization in this demo." }, { status: 400 });
    }

    const protocol = new Protocol(VENUE_ADDRESS, "", MPT_ISSUANCE_ID);
    const didAuth = await protocol.authenticateWallet(recipientWallet);
    const claimResult = await protocol.claimTicket({
      venueId: VENUE_ADDRESS,
      wallet: recipientWallet,
      ticketId: claimId,
      didAuth,
      runtime: {
        xrplClient: {
          request: async (req: any) => client.request(req)
        },
        loadPendingClaim: async (id) => {
            const currentClaims = getPendingClaims(recipientWallet);
            const currentClaim = currentClaims.find(c => c.claimId === id);
            if (!currentClaim) return null;
            return {
                ...currentClaim,
                vendorAddress: VENUE_ADDRESS, // Force valid XRPL address, ignoring potentially corrupted db value
            } as any;
        },
        submitAuthorization: async (authorizeTx) => {
            return submitTx(client, Wallet.fromSeed(recipientSeed), authorizeTx);
        },
        submitTicketRelease: async (releaseTx) => {
            const venueWalletObj = Wallet.fromSeed(DEMO_SEEDS[VENUE_ADDRESS]);
            return submitTx(client, venueWalletObj, releaseTx);
        },
        consumePendingClaim: async (id, updates) => {
            if (updates.status === "claimed") {
                markClaimed(id);
                markPurchaseClaimed(id);
            }
        }
      }
    });

    if (claimResult.claimStatus === "claimed") {
      const releaseHash = (claimResult.releaseResult as any)?.hash;
      return NextResponse.json({ success: true, hash: releaseHash });
    } else {
      return NextResponse.json({ error: `Release failed or skipped.` }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}
