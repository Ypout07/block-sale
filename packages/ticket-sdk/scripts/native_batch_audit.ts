import fs from "node:fs";
import {
  createFundedWallet,
  ensureMockUsdBalance,
  ensureMptAuthorization,
  ensureUsdTrustline,
  getPrimaryPolicyArtifactPath,
  PRIMARY_PURCHASE_AMOUNT,
  provisionPrimaryContext,
  submitNativeBatch,
  submitTx,
  vendorSendsTicketMpt
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

async function fetchFeature(client: any, name: string) {
  const response = await client.request({
    command: "feature"
  });
  const features = (response.result as { features?: Record<string, { enabled?: boolean; supported?: boolean; name?: string }> }).features ?? {};
  return Object.values(features).find((entry) => entry.name === name) ?? null;
}

async function fetchParentBatchMatches(client: any, account: string, batchHash: string) {
  const response = await client.request({
    command: "account_tx",
    account,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: 20
  });

  const txs = (response.result as { transactions?: Array<Record<string, any>> }).transactions ?? [];
  return txs.filter((entry) => entry.meta?.ParentBatchID === batchHash || entry.tx?.ParentBatchID === batchHash);
}

async function run() {
  const context = await provisionPrimaryContext({
    buyerMinimumUsd: "200",
    secondaryMinimumUsd: "200"
  });

  try {
    const scenarios: Scenario[] = [];
    const batchFeature = await fetchFeature(context.client, "Batch");
    const returnerFund = await createFundedWallet(
      context.client,
      context.config,
      undefined,
      "Batch Audit: Create Returner Wallet"
    );
    const returnerWallet = returnerFund.wallet;
    const invalidReturnerFund = await createFundedWallet(
      context.client,
      context.config,
      undefined,
      "Batch Audit: Create Invalid Returner Wallet"
    );
    const invalidReturnerWallet = invalidReturnerFund.wallet;

    await ensureUsdTrustline(context.client, returnerWallet, context.issuerWallet.address, "Batch Audit: Returner TrustSet");
    await ensureUsdTrustline(context.client, invalidReturnerWallet, context.issuerWallet.address, "Batch Audit: Invalid Returner TrustSet");
    await ensureMockUsdBalance(context.client, context.issuerWallet, context.vendorWallet, "200", "Batch Audit: Fund Vendor With Mock RLUSD");
    await ensureMptAuthorization(context.client, returnerWallet, context.issuanceId, "Batch Audit: Returner Authorizes MPT");
    await ensureMptAuthorization(context.client, invalidReturnerWallet, context.issuanceId, "Batch Audit: Invalid Returner Authorizes MPT");

    await vendorSendsTicketMpt(
      context.client,
      context.vendorWallet,
      returnerWallet.address,
      context.issuanceId,
      "Batch Audit: Vendor Sends Ticket To Returner"
    );
    await vendorSendsTicketMpt(
      context.client,
      context.vendorWallet,
      invalidReturnerWallet.address,
      context.issuanceId,
      "Batch Audit: Vendor Sends Ticket To Invalid Returner"
    );

    scenarios.push(
      scenario("batch feature is reported by the connected network", "success", batchFeature ? "success" : "failure", {
        batchFeature
      })
    );

    let validBatch: Awaited<ReturnType<typeof submitNativeBatch>> | null = null;
    let validBatchError: string | null = null;
    let validVendorMatches: Array<Record<string, any>> = [];
    let validReturnerMatches: Array<Record<string, any>> = [];

    try {
      validBatch = await submitNativeBatch({
        client: context.client,
        outerAccountWallet: context.vendorWallet,
        signingWallets: {
          [context.vendorWallet.address]: context.vendorWallet,
          [returnerWallet.address]: returnerWallet
        },
        innerTransactions: [
          {
            TransactionType: "Payment",
            Account: returnerWallet.address,
            Destination: context.vendorWallet.address,
            Amount: {
              mpt_issuance_id: context.issuanceId,
              value: "1"
            }
          },
          {
            TransactionType: "Payment",
            Account: context.vendorWallet.address,
            Destination: returnerWallet.address,
            Amount: {
              currency: "USD",
              issuer: context.issuerWallet.address,
              value: PRIMARY_PURCHASE_AMOUNT
            }
          }
        ],
        label: "Batch Audit: Native Return/Refund Batch",
        config: context.config
      });

      validVendorMatches = await fetchParentBatchMatches(context.client, context.vendorWallet.address, validBatch.hash ?? "");
      validReturnerMatches = await fetchParentBatchMatches(context.client, returnerWallet.address, validBatch.hash ?? "");
    } catch (error) {
      validBatchError = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      scenario(
        "native all-or-nothing batch applies both inner transactions on-ledger",
        "success",
        validBatch && validBatch.accepted && validVendorMatches.length > 0 && validReturnerMatches.length > 0
          ? "success"
          : "failure",
        {
          batchHash: validBatch?.hash ?? null,
          validBatchError,
          vendorInnerCount: validVendorMatches.length,
          returnerInnerCount: validReturnerMatches.length
        }
      )
    );

    let invalidBatchRejected = false;
    let invalidBatchReason: string | null = null;
    let invalidBatchHash: string | null = null;
    try {
      const invalidBatch = await submitNativeBatch({
        client: context.client,
        outerAccountWallet: context.vendorWallet,
        signingWallets: {
          [context.vendorWallet.address]: context.vendorWallet,
          [invalidReturnerWallet.address]: invalidReturnerWallet
        },
        innerTransactions: [
          {
            TransactionType: "Payment",
            Account: invalidReturnerWallet.address,
            Destination: context.vendorWallet.address,
            Amount: {
              mpt_issuance_id: context.issuanceId,
              value: "1"
            }
          },
          {
            TransactionType: "Payment",
            Account: context.vendorWallet.address,
            Destination: invalidReturnerWallet.address,
            Amount: {
              currency: "USD",
              issuer: context.issuerWallet.address,
              value: "999999999"
            }
          }
        ],
        label: "Batch Audit: Invalid Native Batch",
        config: context.config
      });
      invalidBatchHash = invalidBatch.hash ?? null;
      const matches = invalidBatch.hash
        ? [
            ...(await fetchParentBatchMatches(context.client, context.vendorWallet.address, invalidBatch.hash)),
            ...(await fetchParentBatchMatches(context.client, invalidReturnerWallet.address, invalidBatch.hash))
          ]
        : [];
      invalidBatchRejected = matches.length === 0;
      if (!invalidBatchRejected) {
        invalidBatchReason = "Batch ledger transaction succeeded and inner transactions were applied unexpectedly.";
      }
    } catch (error) {
      invalidBatchRejected = true;
      invalidBatchReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      scenario(
        "invalid all-or-nothing batch does not apply inner transactions",
        "success",
        invalidBatchRejected ? "success" : "failure",
        {
          invalidBatchHash,
          invalidBatchReason
        }
      )
    );

    const reportPath = getPrimaryPolicyArtifactPath().replace("primary-policy-config.json", "native-batch-audit.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          vendorAddress: context.vendorWallet.address,
          issuerAddress: context.issuerWallet.address,
          issuanceId: context.issuanceId,
          scenarios
        },
        null,
        2
      )
    );

    console.log("\n=== Native Batch Audit Summary ===");
    for (const entry of scenarios) {
      console.log(`[${entry.passed ? "PASS" : "FAIL"}] ${entry.name}: expected=${entry.expected}, actual=${entry.actual}`);
    }
    console.log(`\nAudit report written to ${reportPath}`);

    if (scenarios.some((entry) => !entry.passed)) {
      process.exitCode = 1;
    }
  } finally {
    await context.client.disconnect();
  }
}

run().catch((error) => {
  console.error("Native batch audit failed:", error);
  process.exitCode = 1;
});
