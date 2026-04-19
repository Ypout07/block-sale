import { Client } from "xrpl";
const XRPL_WS_URL = process.env.XRPL_WS_URL || "ws://127.0.0.1:6006";
const VENUE = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
const ALICE = "rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS";
const ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

async function check() {
  const client = new Client(XRPL_WS_URL);
  await client.connect();
  
  console.log("--- ALICE ---");
  const aliceLines = await client.request({ command: "account_lines", account: ALICE });
  console.log(JSON.stringify(aliceLines.result.lines, null, 2));
  
  console.log("--- VENUE ---");
  const venueLines = await client.request({ command: "account_lines", account: VENUE });
  console.log(JSON.stringify(venueLines.result.lines, null, 2));

  await client.disconnect();
}
check();
