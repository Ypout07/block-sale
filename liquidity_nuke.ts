import { Client, Wallet } from "xrpl";

const XRPL_WS_URL = process.env.XRPL_WS_URL || "ws://127.0.0.1:6006";
const ISSUER_SEED = "sEdTcVsmgfearttgmGVyXipHui29i2K";
const ALICE_SEED = "sEdViyntgnVLEaerZG2vthtbk5MFKQM";
const BOB_SEED = "sEd77gp3s7HHFNF34Xqv6Km9BMfpwp2";
const VENUE_SEED = "sEd77UAry5NZshnbLwf9pwU3pscTDf8";
const ISSUER_ADDR = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

async function nuke() {
  const client = new Client(XRPL_WS_URL);
  await client.connect();

  const issuer = Wallet.fromSeed(ISSUER_SEED);
  const alice = Wallet.fromSeed(ALICE_SEED);
  const bob = Wallet.fromSeed(BOB_SEED);
  const venue = Wallet.fromSeed(VENUE_SEED);

  console.log("1. Enabling DefaultRipple on Issuer...");
  await client.submitAndWait({
    TransactionType: "AccountSet",
    Account: issuer.classicAddress,
    SetFlag: 8, // asfDefaultRipple
  }, { wallet: issuer });

  const participants = [
    { name: "Alice", wallet: alice },
    { name: "Bob", wallet: bob },
    { name: "Venue", wallet: venue }
  ];

  for (const p of participants) {
    console.log(`2. Resetting TrustLine for ${p.name}...`);
    // First, clear any existing NoRipple by setting trustline with explicit flag
    const tx = await client.submitAndWait({
      TransactionType: "TrustSet",
      Account: p.wallet.classicAddress,
      Flags: 0x00020000, // tfClearNoRipple
      LimitAmount: {
        currency: "USD",
        issuer: ISSUER_ADDR,
        value: "1000000"
      }
    }, { wallet: p.wallet });
    
    const res = (tx.result.meta as any)?.TransactionResult;
    console.log(`   ${p.name} Result: ${res}`);
  }

  await client.disconnect();
  console.log("✅ LIQUIDITY UNLOCKED. The path is now clear.");
}

nuke().catch(console.error);
