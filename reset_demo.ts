import { Client, Wallet } from "xrpl";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
const VENUE_ADDRESS = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const MPT_ISSUANCE_ID = "0013825E8499A40F466D9E541672E5B7440444035AB3B298";

const DEMO_SEEDS: Record<string, string> = {
  rDa3E72iujUJciri1B8djcmowVsuNDu4QT: "sEd77UAry5NZshnbLwf9pwU3pscTDf8",
  rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS: "sEdViyntgnVLEaerZG2vthtbk5MFKQM",
  rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z: "sEd77gp3s7HHFNF34Xqv6Km9BMfpwp2",
};

async function reset() {
  const client = new Client(DEVNET_URL);
  await client.connect();

  const BOB_ADDR = "rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z";
  const bobWallet = Wallet.fromSeed(DEMO_SEEDS[BOB_ADDR]);

  console.log("Checking Bob's tickets...");
  const response = await client.request({ command: "account_objects", account: BOB_ADDR });
  const objects = (response.result as any).account_objects || [];
  const ticketToken = objects.find((e: any) => e.LedgerEntryType === "MPToken" && e.MPTokenIssuanceID === MPT_ISSUANCE_ID);

  if (ticketToken && Number(ticketToken.MPTAmount) > 0) {
    console.log(`Bob has ${ticketToken.MPTAmount} tickets. Clearing...`);
    await client.submitAndWait({
      TransactionType: "Payment",
      Account: BOB_ADDR,
      Destination: VENUE_ADDRESS,
      Amount: {
        mpt_issuance_id: MPT_ISSUANCE_ID,
        value: ticketToken.MPTAmount
      }
    }, { wallet: bobWallet });
    console.log("Bob's tickets cleared.");
  } else {
    console.log("Bob has no tickets.");
  }

  await client.disconnect();
}

reset().catch(console.error);
