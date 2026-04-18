import {
  PRIMARY_PURCHASE_AMOUNT,
  buyerPaysVendorInMockUsd,
  provisionPrimaryContext,
  vendorSendsTicketMpt
} from "./lib/primaryFlow.ts";

async function primaryPurchaseFlow() {
  const context = await provisionPrimaryContext();

  try {
    console.log(`\nMPT_ISSUANCE_ID_IN_USE=${context.issuanceId}`);
    console.log(`POLICY_CONFIG_ARTIFACT=${context.artifactPath}`);

    await buyerPaysVendorInMockUsd(
      context.client,
      context.buyerWallet,
      context.issuerWallet.address,
      context.vendorWallet.address,
      PRIMARY_PURCHASE_AMOUNT
    );

    await vendorSendsTicketMpt(
      context.client,
      context.vendorWallet,
      context.buyerWallet.address,
      context.issuanceId,
      "Vendor Sends Ticket MPT To Buyer"
    );

    console.log("\nPrimary purchase flow complete.");
    console.log(`Vendor: ${context.vendorWallet.address}`);
    console.log(`Buyer: ${context.buyerWallet.address}`);
    console.log(`MockRLUSDIssuer: ${context.issuerWallet.address}`);
    console.log(`MPTIssuanceID: ${context.issuanceId}`);
  } finally {
    await context.client.disconnect();
  }
}

primaryPurchaseFlow().catch((error) => {
  console.error("Primary purchase flow failed:", error);
  process.exitCode = 1;
});
