import { Client, Wallet } from "xrpl";
const XRPL_WS_URL = process.env.XRPL_WS_URL || "ws://127.0.0.1:6006";
const ALICE = "rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS";
const BOB = "rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z";
const THIRD = "rEkTUKB9MAPH5pUuu3nJYvnjdfzmwDbSXn";
const ISSUER_SEED = "sEdTcVsmgfearttgmGVyXipHui29i2K";

async function fix() {
  const client = new Client(XRPL_WS_URL);
  await client.connect();
  const issuerWallet = Wallet.fromSeed(ISSUER_SEED);
  
  for (const account of [ALICE, BOB, THIRD]) {
    const response = await client.submitAndWait({
      TransactionType: "Payment",
      Account: issuerWallet.classicAddress,
      Destination: account,
      Amount: {
        currency: "USD",
        issuer: issuerWallet.classicAddress,
        value: "1000"
      }
    }, { wallet: issuerWallet });
    
    const meta = response.result.meta;
    const result = typeof meta === 'object' && meta ? (meta as any).TransactionResult : 'unknown';
    console.log(`${account} funded: ${result}`);
  }
  
  await client.disconnect();
}
fix();
