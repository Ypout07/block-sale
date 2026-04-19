import { NextRequest, NextResponse } from "next/server";
import { Client, Wallet } from "xrpl";
import { getPendingClaims, markClaimed } from "@/lib/claimStore";
import { markPurchaseClaimed } from "@/lib/purchaseStore";

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

    // 1. Authorize
    await submitTx(client, Wallet.fromSeed(recipientSeed), {
      TransactionType: "MPTokenAuthorize",
      Account: recipientWallet,
      MPTokenIssuanceID: MPT_ISSUANCE_ID,
    });

    // 2. Release
    const venueWalletObj = Wallet.fromSeed(DEMO_SEEDS[VENUE_ADDRESS]);
    const releaseResult = await submitTx(client, venueWalletObj, {
      TransactionType: "Payment",
      Account: VENUE_ADDRESS,
      Destination: recipientWallet,
      Amount: { mpt_issuance_id: MPT_ISSUANCE_ID, value: "1" },
    });

    if (releaseResult.meta?.TransactionResult === "tesSUCCESS") {
      markClaimed(claimId);
      markPurchaseClaimed(claimId);
      return NextResponse.json({ success: true, hash: releaseResult.hash });
    } else {
      return NextResponse.json({ error: `Release failed: ${releaseResult.meta?.TransactionResult}` }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await client.disconnect();
  }
}
