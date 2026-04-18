import fs from "node:fs";
import {
  createCredentialAuthProvider,
  Protocol,
  type WalletDidAuth
} from "../dist/index.js";
import {
  getPrimaryPolicyArtifactPath,
  provisionPrimaryContext,
  submitTx
} from "./lib/primaryFlow.ts";

type Scenario = {
  name: string;
  expected: "success" | "failure";
  actual: "success" | "failure";
  passed: boolean;
  details: Record<string, unknown>;
};

function scenario(
  name: string,
  expected: "success" | "failure",
  actual: "success" | "failure",
  details: Record<string, unknown>
): Scenario {
  return {
    name,
    expected,
    actual,
    passed: expected === actual,
    details
  };
}

function extractDomainId(candidate: unknown): string | undefined {
  const raw =
    candidate && typeof candidate === "object" && "raw" in candidate
      ? (candidate as { raw?: any }).raw
      : candidate;
  const meta = raw?.meta ?? raw?.result?.meta;
  const nodes = meta?.AffectedNodes ?? [];
  for (const node of nodes) {
    const created = node?.CreatedNode;
    const modified = node?.ModifiedNode;
    const domainNode = created?.LedgerEntryType === "PermissionedDomain" ? created : modified?.LedgerEntryType === "PermissionedDomain" ? modified : null;
    if (domainNode?.LedgerIndex) {
      return domainNode.LedgerIndex;
    }
  }
  return undefined;
}

async function fetchPermissionedDomains(client: any, account: string) {
  const response = await client.request({
    command: "account_objects",
    account
  });
  return ((response.result as { account_objects?: Array<Record<string, unknown>> }).account_objects ?? []).filter(
    (entry) => entry.LedgerEntryType === "PermissionedDomain"
  );
}

async function run() {
  const context = await provisionPrimaryContext();

  try {
    const features = await context.client.request({
      command: "feature"
    });

    const featureEntries = Object.values((features.result as { features?: Record<string, { name?: string; enabled?: boolean; supported?: boolean }> }).features ?? {});
    const batchFeature = featureEntries.find((entry) => entry.name === "Batch");
    const permissionedDomainsFeature = featureEntries.find((entry) => entry.name === "PermissionedDomains");

    const credentialProvider = createCredentialAuthProvider({
      xrplClient: context.client,
      defaultIssuerAddress: context.issuerWallet.address
    });
    const protocol = new Protocol(
      context.vendorWallet.address,
      context.issuerWallet.address,
      context.issuanceId,
      credentialProvider
    );

    const issueCredentialAuth = (wallet: { address: string }) =>
      protocol.authenticateWallet({
        wallet: wallet.address,
        issuerAddress: context.issuerWallet.address,
        xrplClient: context.client,
        submitCredentialCreate: (tx) =>
          submitTx(context.client, context.issuerWallet, tx, `Permissioned Domain Audit: CredentialCreate For ${wallet.address}`),
        submitCredentialAccept: (tx) =>
          submitTx(context.client, wallet as any, tx, `Permissioned Domain Audit: CredentialAccept For ${wallet.address}`)
      });

    const vendorDidAuth = (await issueCredentialAuth(context.vendorWallet)) as WalletDidAuth;

    const scenarios: Scenario[] = [];

    let missingDidRejected = false;
    let missingDidReason: string | null = null;
    try {
      await protocol.setPermissionedDomain({
        wallet: context.vendorWallet.address,
        acceptedCredentials: [
          {
            issuer: context.issuerWallet.address,
            credentialType: vendorDidAuth.credentialType ?? ""
          }
        ]
      });
    } catch (error) {
      missingDidRejected = true;
      missingDidReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      scenario("permissioned domain creation requires verified auth", "success", missingDidRejected ? "success" : "failure", {
        missingDidReason
      })
    );

    const setResult = await protocol.setPermissionedDomain({
      wallet: context.vendorWallet.address,
      didAuth: vendorDidAuth,
      acceptedCredentials: [
        {
          issuer: context.issuerWallet.address,
          credentialType: vendorDidAuth.credentialType ?? ""
        }
      ],
      runtime: {
        submitDomainSet: (tx) =>
          submitTx(context.client, context.vendorWallet, tx, "Permissioned Domain Audit: PermissionedDomainSet")
      }
    });

    const domainId = extractDomainId(setResult.result);
    const domainsAfterSet = await fetchPermissionedDomains(context.client, context.vendorWallet.address);
    const createdDomain = domainsAfterSet.find((entry) => entry.index === domainId || entry.LedgerIndex === domainId);

    scenarios.push(
      scenario(
        "permissioned domain can be created on-ledger",
        "success",
        setResult.status === "submitted" && Boolean(domainId) && Boolean(createdDomain) ? "success" : "failure",
        {
          batchFeature,
          permissionedDomainsFeature,
          domainId,
          txHash: (setResult.result as any)?.hash ?? (setResult.result as any)?.raw?.hash ?? null
        }
      )
    );

    if (!domainId) {
      throw new Error("PermissionedDomainSet did not produce a PermissionedDomain ledger object.");
    }

    const deleteResult = await protocol.deletePermissionedDomain({
      wallet: context.vendorWallet.address,
      domainId,
      didAuth: vendorDidAuth,
      runtime: {
        submitDomainDelete: (tx) =>
          submitTx(context.client, context.vendorWallet, tx, "Permissioned Domain Audit: PermissionedDomainDelete")
      }
    });

    const domainsAfterDelete = await fetchPermissionedDomains(context.client, context.vendorWallet.address);
    const deleted = !domainsAfterDelete.some((entry) => entry.index === domainId || entry.LedgerIndex === domainId);

    scenarios.push(
      scenario("permissioned domain can be deleted on-ledger", "success", deleted ? "success" : "failure", {
        domainId,
        txHash: (deleteResult.result as any)?.hash ?? (deleteResult.result as any)?.raw?.hash ?? null
      })
    );

    const reportPath = getPrimaryPolicyArtifactPath().replace("primary-policy-config.json", "permissioned-domain-audit.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          vendorAddress: context.vendorWallet.address,
          issuerAddress: context.issuerWallet.address,
          features: {
            batch: batchFeature ?? null,
            permissionedDomains: permissionedDomainsFeature ?? null
          },
          scenarios
        },
        null,
        2
      )
    );

    console.log("\n=== Permissioned Domain Audit Summary ===");
    for (const entry of scenarios) {
      console.log(`[${entry.passed ? "PASS" : "FAIL"}] ${entry.name}: expected=${entry.expected}, actual=${entry.actual}`);
    }
    console.log(`\nAudit report written to ${reportPath}`);
  } finally {
    await context.client.disconnect();
  }
}

run().catch((error) => {
  console.error("Permissioned domain audit failed:", error);
  process.exitCode = 1;
});
