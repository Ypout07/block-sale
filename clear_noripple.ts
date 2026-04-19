import { Client, Wallet } from "xrpl";
const XRPL_WS_URL = process.env.XRPL_WS_URL || "ws://127.0.0.1:6006";
const ALICE_SEED = "sEdViyntgnVLEaerZG2vthtbk5MFKQM";
const ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

async function fix() {
  const client = new Client(XRPL_WS_URL);
  await client.connect();
  const alice = Wallet.fromSeed(ALICE_SEED);
  
  const response = await client.submitAndWait({
    TransactionType: "TrustSet",
    Account: alice.classicAddress,
    Flags: 0x00020000, // tfClearNoRipple
    LimitAmount: {
      currency: "USD",
      issuer: ISSUER,
      value: "1000000"
    }
  }, { wallet: alice });
  
  const meta = response.result.meta;
  const result = typeof meta === 'object' && meta ? (meta as any).TransactionResult : 'unknown';
  console.log("Alice trustline fixed:", result);
  await client.disconnect();
}
fix();
