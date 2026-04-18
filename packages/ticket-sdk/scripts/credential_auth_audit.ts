import { createCredentialAuthProvider, Protocol } from "../dist/index.js";
import { createClient, submitTx } from "./lib/primaryFlow.ts";

type AuditScenario = {
  name: string;
  expected: "success" | "failure";
  actual: "success" | "failure";
  passed: boolean;
  notes: string;
  details: Record<string, unknown>;
};

function reportScenario(
  name: string,
  expected: "success" | "failure",
  actual: "success" | "failure",
  notes: string,
  details: Record<string, unknown>
): AuditScenario {
  return {
    name,
    expected,
    actual,
    passed: expected === actual,
    notes,
    details
  };
}

async function runAudit() {
  const client = createClient();
  await client.connect();

  try {
    const issuerFund = await client.fundWallet();
    const holderFund = await client.fundWallet();
    const wrongFund = await client.fundWallet();

    const issuerWallet = issuerFund.wallet;
    const holderWallet = holderFund.wallet;
    const wrongWallet = wrongFund.wallet;

    const credentialProvider = createCredentialAuthProvider({
      xrplClient: client,
      defaultIssuerAddress: issuerWallet.address
    });
    const protocol = new Protocol("rVenuePlaceholder11111111111111111111111", issuerWallet.address, "", credentialProvider);

    const artifact = await protocol.authenticateWallet({
      wallet: holderWallet.address,
      issuerAddress: issuerWallet.address,
      xrplClient: client,
      submitCredentialCreate: (tx) =>
        submitTx(client, issuerWallet, tx, "Credential Audit: Issuer Creates Credential"),
      submitCredentialAccept: (tx) =>
        submitTx(client, holderWallet, tx, "Credential Audit: Holder Accepts Credential")
    });

    const scenarios: AuditScenario[] = [];

    const verified = await protocol.verifyWallet(holderWallet.address, artifact);
    scenarios.push(
      reportScenario(
        "on-chain credential verifies for the intended wallet",
        "success",
        verified.verified ? "success" : "failure",
        "A wallet should authenticate through real XRPL credential issuance and acceptance.",
        {
          provider: verified.provider,
          credentialIssuer: artifact.credentialIssuer ?? null,
          credentialType: artifact.credentialType ?? null
        }
      )
    );

    const wrongWalletVerification = await protocol.verifyWallet(wrongWallet.address, artifact);
    scenarios.push(
      reportScenario(
        "credential is rejected for the wrong wallet",
        "success",
        wrongWalletVerification.verified ? "failure" : "success",
        "The credential auth artifact must be wallet-bound and unusable by any other account.",
        {
          reason: wrongWalletVerification.reason ?? null
        }
      )
    );

    const tamperedArtifact = {
      ...artifact,
      credentialIssuer: wrongWallet.address
    };
    const tamperedVerification = await protocol.verifyWallet(holderWallet.address, tamperedArtifact);
    scenarios.push(
      reportScenario(
        "credential verification fails when issuer metadata is tampered",
        "success",
        tamperedVerification.verified ? "failure" : "success",
        "The SDK should reject credential artifacts that no longer match an accepted on-ledger credential.",
        {
          reason: tamperedVerification.reason ?? null
        }
      )
    );

    console.log("\n=== Credential Auth Audit Summary ===");
    for (const scenario of scenarios) {
      console.log(
        `[${scenario.passed ? "PASS" : "FAIL"}] ${scenario.name}: expected=${scenario.expected}, actual=${scenario.actual}`
      );
    }
  } finally {
    await client.disconnect();
  }
}

runAudit().catch((error) => {
  console.error("Credential auth audit failed:", error);
  process.exitCode = 1;
});
