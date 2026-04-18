import fs from "node:fs";
import { Protocol } from "../dist/index.js";
import type { SubmittedTx } from "./lib/primaryFlow.ts";
import {
  PRIMARY_PURCHASE_AMOUNT,
  ensureMockUsdBalance,
  ensureUsdTrustline,
  getPrimaryAuditReportPath,
  provisionPrimaryContext,
  submitTx
} from "./lib/primaryFlow.ts";
import {
  consumePendingClaim,
  getPolicyStatePath,
  loadPendingClaim,
  resetPolicyState,
  storePendingClaim,
  updateClaimRecord
} from "./lib/policyGate.ts";

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
  const context = await provisionPrimaryContext({
    buyerMinimumUsd: "200",
    secondaryMinimumUsd: "200"
  });

  try {
    resetPolicyState();
    const candidateFund = await context.client.fundWallet();
    const candidateWallet = candidateFund.wallet;

    await ensureUsdTrustline(
      context.client,
      candidateWallet,
      context.issuerWallet.address,
      "Candidate TrustSet For Mock RLUSD"
    );
    await ensureMockUsdBalance(
      context.client,
      context.issuerWallet,
      candidateWallet,
      "150",
      "Issuer Funds Candidate With Mock RLUSD"
    );

    const protocol = new Protocol(
      context.vendorWallet.address,
      context.issuerWallet.address,
      context.issuanceId
    );

    const submitBuyerPayment = (wallet: { address: string; seed?: string }, label: string) => {
      return (paymentTx: any) =>
        submitTx(
          context.client,
          wallet as any,
          {
            ...paymentTx,
            Account: wallet.address
          },
          label
        );
    };

    const submitVendorRelease = (labelPrefix: string) => {
      return (releaseTx: any, releaseContext: { recipientWallet: string; ticketIndex: number }) =>
        submitTx(
          context.client,
          context.vendorWallet,
          releaseTx,
          `${labelPrefix} #${releaseContext.ticketIndex + 1} -> ${releaseContext.recipientWallet}`
        );
    };

    const scenarios: AuditScenario[] = [];

    let purchaseDidRejected = false;
    let purchaseDidReason: string | null = null;
    try {
      await protocol.buyGiftTickets({
        venueId: context.vendorWallet.address,
        payerWallet: context.buyerWallet.address,
        recipients: [context.buyerWallet.address],
        amountRlusd: Number(PRIMARY_PURCHASE_AMOUNT),
        runtime: {
          verifyDidProof: async (wallet) => ({
            wallet,
            verified: false,
            provider: "mock-phone-proof"
          }),
          submitPayment: submitBuyerPayment(context.buyerWallet, "Audit: Unexpected Purchase With Failed DID")
        }
      });
    } catch (error) {
      purchaseDidRejected = true;
      purchaseDidReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "purchase is rejected when payer DID verification fails",
        "success",
        purchaseDidRejected ? "success" : "failure",
        "DID verification must gate the purchase step so the payer cannot start the flow without identity proof.",
        {
          purchaseDidReason
        }
      )
    );

    const soloPurchase = await protocol.buyGiftTickets({
      venueId: context.vendorWallet.address,
      payerWallet: context.buyerWallet.address,
      recipients: [context.buyerWallet.address],
      amountRlusd: Number(PRIMARY_PURCHASE_AMOUNT),
      runtime: {
        xrplClient: context.client,
        submitPayment: submitBuyerPayment(context.buyerWallet, "Audit: Solo Buyer Pays Vendor"),
        submitTicketRelease: submitVendorRelease("Audit: Vendor Releases Solo Ticket"),
        persistPendingClaim: storePendingClaim
      }
    });

    scenarios.push(
      reportScenario(
        "solo purchase settles and delivers immediately",
        "success",
        soloPurchase.approval && soloPurchase.deliveredRecipients.length === 1 && soloPurchase.pendingRecipients.length === 0
          ? "success"
          : "failure",
        "A one-person purchase should behave as a group of one and deliver immediately when the buyer is already authorized.",
        {
          paymentHash: ((soloPurchase.paymentResult as SubmittedTx | undefined)?.hash) ?? null,
          deliveredRecipients: soloPurchase.deliveredRecipients.map((recipient) => recipient.recipientWallet),
          pendingRecipients: soloPurchase.pendingRecipients.map((recipient) => recipient.recipientWallet)
        }
      )
    );

    const groupPurchase = await protocol.buyGiftTickets({
      venueId: context.vendorWallet.address,
      payerWallet: context.secondaryWallet.address,
      recipients: [context.secondaryWallet.address, candidateWallet.address],
      amountRlusd: Number(PRIMARY_PURCHASE_AMOUNT) * 2,
      runtime: {
        xrplClient: context.client,
        submitPayment: submitBuyerPayment(context.secondaryWallet, "Audit: Group Buyer Pays Vendor"),
        submitTicketRelease: submitVendorRelease("Audit: Vendor Releases Group Ticket"),
        persistPendingClaim: storePendingClaim
      }
    });

    const pendingCandidate = groupPurchase.pendingRecipients.find(
      (recipient) => recipient.recipientWallet === candidateWallet.address
    );
    const deliveredSecondary = groupPurchase.deliveredRecipients.find(
      (recipient) => recipient.recipientWallet === context.secondaryWallet.address
    );

    scenarios.push(
      reportScenario(
        "group purchase delivers authorized recipients and queues the rest",
        "success",
        deliveredSecondary && pendingCandidate?.status === "pending_authorization" && groupPurchase.failedRecipients.length === 0
          ? "success"
          : "failure",
        "The buyer can pay for multiple recipients at once; authorized recipients receive tickets immediately and unauthorized recipients stay pending.",
        {
          paymentHash: ((groupPurchase.paymentResult as SubmittedTx | undefined)?.hash) ?? null,
          deliveredRecipients: groupPurchase.deliveredRecipients.map((recipient) => recipient.recipientWallet),
          pendingRecipients: groupPurchase.pendingRecipients.map((recipient) => ({
            recipientWallet: recipient.recipientWallet,
            status: recipient.status,
            reason: recipient.reason
          }))
        }
      )
    );

    if (!pendingCandidate?.pendingClaimId) {
      throw new Error("Expected pending candidate to receive a pendingClaimId.");
    }

    const persistedPendingClaim = loadPendingClaim(pendingCandidate.pendingClaimId);
    scenarios.push(
      reportScenario(
        "pending claim is persisted for later recipient fulfillment",
        "success",
        persistedPendingClaim?.recipientWallet === candidateWallet.address ? "success" : "failure",
        "A deferred recipient needs a durable claim record so the later claim flow can prove purchase provenance.",
        {
          pendingClaimId: pendingCandidate.pendingClaimId,
          persistedStatus: persistedPendingClaim?.status ?? null
        }
      )
    );

    let claimDidRejected = false;
    let claimDidReason: string | null = null;
    try {
      await protocol.claimTicket({
        venueId: context.vendorWallet.address,
        wallet: candidateWallet.address,
        ticketId: pendingCandidate.pendingClaimId,
        runtime: {
          xrplClient: context.client,
          verifyDidProof: async (wallet) => ({
            wallet,
            verified: false,
            provider: "mock-phone-proof"
          }),
          loadPendingClaim,
          submitAuthorization: (authorizeTx) =>
            submitTx(context.client, candidateWallet, authorizeTx, "Audit: Unexpected Claim Authorization With Failed DID"),
          submitTicketRelease: (releaseTx, pendingClaim) =>
            submitTx(
              context.client,
              context.vendorWallet,
              releaseTx,
              `Audit: Unexpected Claim Release #${pendingClaim.ticketIndex + 1} -> ${pendingClaim.recipientWallet}`
            ),
          consumePendingClaim
        }
      });
    } catch (error) {
      claimDidRejected = true;
      claimDidReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "claim is rejected when recipient DID verification fails",
        "success",
        claimDidRejected ? "success" : "failure",
        "A deferred recipient should not be able to authorize and receive the ticket until DID verification succeeds.",
        {
          pendingClaimId: pendingCandidate.pendingClaimId,
          claimDidReason
        }
      )
    );

    const claimResult = await protocol.claimTicket({
      venueId: context.vendorWallet.address,
      wallet: candidateWallet.address,
      ticketId: pendingCandidate.pendingClaimId,
      runtime: {
        xrplClient: context.client,
        loadPendingClaim,
        submitAuthorization: (authorizeTx) =>
          submitTx(context.client, candidateWallet, authorizeTx, "Audit: Candidate Authorizes Pending Claim"),
        submitTicketRelease: (releaseTx, pendingClaim) =>
          submitTx(
            context.client,
            context.vendorWallet,
            releaseTx,
            `Audit: Vendor Releases Claimed Ticket #${pendingClaim.ticketIndex + 1} -> ${pendingClaim.recipientWallet}`
          ),
        consumePendingClaim
      }
    });

    const claimedPending = loadPendingClaim(pendingCandidate.pendingClaimId);
    scenarios.push(
      reportScenario(
        "pending recipient can authorize and claim exactly once",
        "success",
        claimResult.claimStatus === "claimed" && claimedPending?.status === "claimed" ? "success" : "failure",
        "A deferred recipient should complete authorization later, receive the MPT, and transition from pending to claimed.",
        {
          pendingClaimId: pendingCandidate.pendingClaimId,
          authorizationHash: ((claimResult.authorizationResult as SubmittedTx | undefined)?.hash) ?? null,
          releaseHash: ((claimResult.releaseResult as SubmittedTx | undefined)?.hash) ?? null,
          pendingStatus: claimedPending?.status ?? null
        }
      )
    );

    let duplicateClaimRejected = false;
    let duplicateClaimReason: string | null = null;
    try {
      await protocol.claimTicket({
        venueId: context.vendorWallet.address,
        wallet: candidateWallet.address,
        ticketId: pendingCandidate.pendingClaimId,
        runtime: {
          xrplClient: context.client,
          loadPendingClaim,
          submitAuthorization: (authorizeTx) =>
            submitTx(context.client, candidateWallet, authorizeTx, "Audit: Duplicate Candidate Authorization"),
          submitTicketRelease: (releaseTx, pendingClaim) =>
            submitTx(
              context.client,
              context.vendorWallet,
              releaseTx,
              `Audit: Duplicate Vendor Release #${pendingClaim.ticketIndex + 1} -> ${pendingClaim.recipientWallet}`
            ),
          consumePendingClaim
        }
      });
    } catch (error) {
      duplicateClaimRejected = true;
      duplicateClaimReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "duplicate claim is rejected after consumption",
        "success",
        duplicateClaimRejected ? "success" : "failure",
        "Once a pending allocation is claimed, the SDK must reject any second attempt to release the same ticket.",
        {
          pendingClaimId: pendingCandidate.pendingClaimId,
          duplicateClaimReason
        }
      )
    );

    const qrResult = await protocol.generateTicketQr({
      ticketId: pendingCandidate.pendingClaimId,
      wallet: candidateWallet.address,
      didToken: `${candidateWallet.address}:mock-phone-proof`,
      nonce: "audit-redeem-nonce-001",
      issuedAt: new Date("2026-04-18T12:00:00.000Z"),
      ttlMs: 90_000
    });

    let redeemDidRejected = false;
    let redeemDidReason: string | null = null;
    try {
      await protocol.redeemTicket({
        ticketId: pendingCandidate.pendingClaimId,
        wallet: candidateWallet.address,
        venueId: context.vendorWallet.address,
        qrCodeText: qrResult.qrCodeText,
        runtime: {
          loadPendingClaim,
          updateClaimRecord,
          verifyDidProof: async (wallet) => ({
            wallet,
            verified: false,
            provider: "mock-phone-proof"
          }),
          now: () => new Date("2026-04-18T12:00:20.000Z")
        }
      });
    } catch (error) {
      redeemDidRejected = true;
      redeemDidReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "redeem is rejected when DID verification fails",
        "success",
        redeemDidRejected ? "success" : "failure",
        "Venue entry should fail if the wallet cannot produce the required DID proof at scan time.",
        {
          ticketId: pendingCandidate.pendingClaimId,
          redeemDidReason
        }
      )
    );

    const redeemResult = await protocol.redeemTicket({
      ticketId: pendingCandidate.pendingClaimId,
      wallet: candidateWallet.address,
      venueId: context.vendorWallet.address,
      qrCodeText: qrResult.qrCodeText,
      runtime: {
        loadPendingClaim,
        updateClaimRecord,
        verifyDidProof: (wallet) => protocol.verifyWallet(wallet),
        now: () => new Date("2026-04-18T12:00:30.000Z")
      }
    });

    const redeemedRecord = loadPendingClaim(pendingCandidate.pendingClaimId);
    scenarios.push(
      reportScenario(
        "claimed ticket can be redeemed with a valid QR scan",
        "success",
        redeemResult.redemptionStatus === "redeemed" && redeemedRecord?.status === "redeemed" ? "success" : "failure",
        "A claimed ticket should become redeemed when a short-lived QR tied to wallet+DID is scanned within its validity window.",
        {
          ticketId: pendingCandidate.pendingClaimId,
          redemptionHash: redeemResult.redemptionHash,
          qrExpiresAt: qrResult.payload.expiresAt,
          redeemedStatus: redeemedRecord?.status ?? null
        }
      )
    );

    let tamperedQrRejected = false;
    let tamperedQrReason: string | null = null;
    try {
      const tamperedQr = await protocol.generateTicketQr({
        ticketId: "tampered-demo-ticket",
        wallet: candidateWallet.address,
        didToken: `${candidateWallet.address}:mock-phone-proof`,
        nonce: "audit-tampered-nonce-001",
        issuedAt: new Date("2026-04-18T12:00:00.000Z"),
        ttlMs: 90_000
      });
      const tamperedPayload = JSON.parse(tamperedQr.qrCodeText) as Record<string, unknown>;
      tamperedPayload.didToken = "tampered-did-token";
      await protocol.redeemTicket({
        ticketId: "tampered-demo-ticket",
        wallet: candidateWallet.address,
        venueId: context.vendorWallet.address,
        qrCodeText: JSON.stringify(tamperedPayload),
        runtime: {
          now: () => new Date("2026-04-18T12:00:35.000Z")
        }
      });
    } catch (error) {
      tamperedQrRejected = true;
      tamperedQrReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "tampered qr payload is rejected",
        "success",
        tamperedQrRejected ? "success" : "failure",
        "If any QR payload field changes after generation, the scanner must reject it because the hash no longer matches.",
        {
          tamperedQrReason
        }
      )
    );

    let duplicateRedeemRejected = false;
    let duplicateRedeemReason: string | null = null;
    try {
      await protocol.redeemTicket({
        ticketId: pendingCandidate.pendingClaimId,
        wallet: candidateWallet.address,
        venueId: context.vendorWallet.address,
        qrCodeText: qrResult.qrCodeText,
        runtime: {
          loadPendingClaim,
          updateClaimRecord,
          verifyDidProof: (wallet) => protocol.verifyWallet(wallet),
          now: () => new Date("2026-04-18T12:00:40.000Z")
        }
      });
    } catch (error) {
      duplicateRedeemRejected = true;
      duplicateRedeemReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "redeemed ticket cannot be scanned twice",
        "success",
        duplicateRedeemRejected ? "success" : "failure",
        "Venue scanning must be one-time so the same QR cannot be replayed after entry.",
        {
          ticketId: pendingCandidate.pendingClaimId,
          duplicateRedeemReason
        }
      )
    );

    let expiredRedeemRejected = false;
    let expiredRedeemReason: string | null = null;
    try {
      const expiredQr = await protocol.generateTicketQr({
        ticketId: "expired-demo-ticket",
        wallet: candidateWallet.address,
        didToken: `${candidateWallet.address}:mock-phone-proof`,
        nonce: "audit-expired-nonce-001",
        issuedAt: new Date("2026-04-18T12:00:00.000Z"),
        ttlMs: 30_000
      });

      await protocol.redeemTicket({
        ticketId: "expired-demo-ticket",
        wallet: candidateWallet.address,
        venueId: context.vendorWallet.address,
        qrCodeText: expiredQr.qrCodeText,
        runtime: {
          now: () => new Date("2026-04-18T12:01:00.000Z")
        }
      });
    } catch (error) {
      expiredRedeemRejected = true;
      expiredRedeemReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "expired qr code is rejected",
        "success",
        expiredRedeemRejected ? "success" : "failure",
        "The venue scanner must reject old QR payloads so screenshots and stale codes cannot be replayed later.",
        {
          expiredRedeemReason
        }
      )
    );

    let wrongVenueRejected = false;
    let wrongVenueReason: string | null = null;
    try {
      const venueMismatchQr = await protocol.generateTicketQr({
        ticketId: "venue-mismatch-demo-ticket",
        wallet: candidateWallet.address,
        didToken: `${candidateWallet.address}:mock-phone-proof`,
        nonce: "audit-venue-mismatch-001",
        issuedAt: new Date("2026-04-18T12:00:00.000Z"),
        ttlMs: 90_000
      });

      await protocol.redeemTicket({
        ticketId: "venue-mismatch-demo-ticket",
        wallet: candidateWallet.address,
        venueId: "rWrongVenue1111111111111111111111111",
        qrCodeText: venueMismatchQr.qrCodeText,
        runtime: {
          now: () => new Date("2026-04-18T12:00:10.000Z")
        }
      });
    } catch (error) {
      wrongVenueRejected = true;
      wrongVenueReason = error instanceof Error ? error.message : String(error);
    }

    scenarios.push(
      reportScenario(
        "qr code cannot be scanned at the wrong venue",
        "success",
        wrongVenueRejected ? "success" : "failure",
        "The QR contract must be venue-bound so a valid ticket for one venue cannot be replayed at another scanner endpoint.",
        {
          wrongVenueReason
        }
      )
    );

    const planningOnly = await protocol.buyGiftTickets({
      venueId: context.vendorWallet.address,
      payerWallet: context.secondaryWallet.address,
      recipients: [candidateWallet.address],
      amountRlusd: Number(PRIMARY_PURCHASE_AMOUNT)
    });

    scenarios.push(
      reportScenario(
        "purchase endpoint can still build a plan without execution hooks",
        "success",
        planningOnly.paymentStatus === "planned" && planningOnly.paymentTx.TransactionType === "Payment"
          ? "success"
          : "failure",
        "The same SDK method should support UI planning before signatures happen, without splitting into a second public buy API.",
        {
          purchaseMode: planningOnly.purchaseMode,
          groupSize: planningOnly.groupSize,
          paymentStatus: planningOnly.paymentStatus
        }
      )
    );

    const report = {
      generatedAt: new Date().toISOString(),
      vendorAddress: context.vendorWallet.address,
      buyerAddress: context.buyerWallet.address,
      secondaryAddress: context.secondaryWallet.address,
      candidateAddress: candidateWallet.address,
      issuerAddress: context.issuerWallet.address,
      issuanceId: context.issuanceId,
      policyStatePath: getPolicyStatePath(),
      scenarios,
      soloPurchase: {
        deliveredRecipients: soloPurchase.deliveredRecipients,
        pendingRecipients: soloPurchase.pendingRecipients
      },
      groupPurchase: {
        deliveredRecipients: groupPurchase.deliveredRecipients,
        pendingRecipients: groupPurchase.pendingRecipients
      },
      claimResult: {
        ticketId: pendingCandidate.pendingClaimId,
        claimStatus: claimResult.claimStatus
      },
      redemptionResult: {
        ticketId: pendingCandidate.pendingClaimId,
        redemptionStatus: redeemResult.redemptionStatus,
        redemptionHash: redeemResult.redemptionHash
      }
    };

    const reportPath = getPrimaryAuditReportPath();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n=== Primary Policy Audit Summary ===");
    for (const scenario of scenarios) {
      console.log(
        `[${scenario.passed ? "PASS" : "FAIL"}] ${scenario.name}: expected=${scenario.expected}, actual=${scenario.actual}`
      );
    }
    console.log(`\nAudit report written to ${reportPath}`);
  } finally {
    await context.client.disconnect();
  }
}

runAudit().catch((error) => {
  console.error("Primary policy audit failed:", error);
  process.exitCode = 1;
});
