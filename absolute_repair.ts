import { Client, Wallet } from "xrpl";

const XRPL_WS_URL = process.env.XRPL_WS_URL || "ws://127.0.0.1:6006";

async function repair() {
  const client = new Client(XRPL_WS_URL);
  await client.connect();

  const ISSUER_ADDR = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";
  const seeds = [
    { name: "Alice", seed: "sEdViyntgnVLEaerZG2vthtbk5MFKQM" },
    { name: "Bob", seed: "sEd77gp3s7HHFNF34Xqv6Km9BMfpwp2" },
    { name: "Venue", seed: "sEd77UAry5NZshnbLwf9pwU3pscTDf8" }
  ];

  for (const s of seeds) {
    const wallet = Wallet.fromSeed(s.seed);
    console.log(`Fixing ${s.name}...`);
    
    // Force clear NoRipple using the absolute decimal flag 131072
    const tx = await client.submitAndWait({
      TransactionType: "TrustSet",
      Account: wallet.classicAddress,
      Flags: 131072, // tfClearNoRipple
      LimitAmount: {
        currency: "USD",
        issuer: ISSUER_ADDR,
        value: "1000000"
      }
    }, { wallet });

    // Verify
    const lines = await client.request({ command: "account_lines", account: wallet.classicAddress, peer: ISSUER_ADDR });
    const isFixed = !lines.result.lines[0].no_ripple;
    console.log(`   ${s.name} Verified Fixed: ${isFixed}`);
  }

  await client.disconnect();
}
repair();
