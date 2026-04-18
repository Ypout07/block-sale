import { Client } from "xrpl";

async function diag() {
  const client = new Client("wss://s.devnet.rippletest.net:51233");
  await client.connect();

  const ALICE = "rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS";
  const BOB = "rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z";
  const VENUE = "rDa3E72iujUJciri1B8djcmowVsuNDu4QT";
  const ISSUER = "rLVPGrB5vPYryqtghu3zQ9F6mSdJmNEJB1";

  const aliceLines = await client.request({ command: "account_lines", account: ALICE, peer: ISSUER });
  const bobLines = await client.request({ command: "account_lines", account: BOB, peer: ISSUER });
  const venueLines = await client.request({ command: "account_lines", account: VENUE, peer: ISSUER });
  const issuerInfo = await client.request({ command: "account_info", account: ISSUER });
  const venueInfo = await client.request({ command: "account_info", account: VENUE });

  console.log("ALICE Trustline:", JSON.stringify(aliceLines.result.lines, null, 2));
  console.log("BOB Trustline:", JSON.stringify(bobLines.result.lines, null, 2));
  console.log("VENUE Trustline:", JSON.stringify(venueLines.result.lines, null, 2));
  console.log("ISSUER Flags:", issuerInfo.result.account_data.Flags);
  console.log("VENUE Flags:", venueInfo.result.account_data.Flags);

  await client.disconnect();
}
diag();
