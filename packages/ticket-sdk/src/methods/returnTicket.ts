import type { Payment } from "xrpl";
import {
  mockDidAuthProvider,
  type DidAuthProvider,
  type WalletDidAuth
} from "../oracle/mockDidVerifier.js";
import type { PendingClaimRecord } from "./claimTicket.js";
import type { WaitlistEntryRecord } from "./joinWaitlist.js";

export type ReturnTicketBatchMode = "ALL_OR_NOTHING";

export type ReturnTicketBatchPlan = {
  batchMode: ReturnTicketBatchMode;
  transactions: Array<{
    role: "ticket_return" | "refund" | "waitlist_escrow_finish";
    tx: Record<string, unknown>;
  }>;
};

export type ReturnTicketRuntime = {
  authProvider?: DidAuthProvider;
  loadClaimRecord?: (ticketId: string) => Promise<PendingClaimRecord | null> | PendingClaimRecord | null;
  loadNextWaitlistEntry?: (venueId: string) => Promise<WaitlistEntryRecord | null> | WaitlistEntryRecord | null;
  submitReturnBatch?: (
    batchPlan: ReturnTicketBatchPlan,
    context: { claimRecord: PendingClaimRecord; waitlistEntry?: WaitlistEntryRecord | null }
  ) => Promise<{
    batchHash?: string;
    results: Record<"ticket_return" | "refund" | "waitlist_escrow_finish", unknown | null>;
  }>;
  updateClaimRecord?: (
    ticketId: string,
    updates: {
      status: "returned";
      returnedAt: string;
      returnBatchHash?: string;
      refundTxHash?: string;
      waitlistAllocationId?: string;
    }
  ) => Promise<void> | void;
  updateWaitlistEntry?: (
    waitlistId: string,
    updates:
      | { status: "allocated"; allocatedAt: string; ticketId: string; escrowFinishHash?: string }
      | { status: "returned"; returnedAt: string }
  ) => Promise<void> | void;
  persistPendingClaim?: (pendingClaim: PendingClaimRecord) => Promise<void> | void;
};

export type ReturnTicketInput = {
  venueId: string;
  wallet: string;
  ticketId: string;
  didAuth?: WalletDidAuth;
  runtime?: ReturnTicketRuntime;
};

export type ReturnTicketResult = {
  ticketId: string;
  returnStatus: "planned" | "returned";
  batchPlan: ReturnTicketBatchPlan;
  claimRecord?: PendingClaimRecord;
  allocatedWaitlistEntry?: WaitlistEntryRecord | null;
  batchResult?: {
    batchHash?: string;
    results: Record<"ticket_return" | "refund" | "waitlist_escrow_finish", unknown | null>;
  };
};

function unwrapTxResult(candidate: unknown): Record<string, any> {
  if (candidate && typeof candidate === "object" && "raw" in candidate) {
    const raw = (candidate as { raw?: unknown }).raw;
    if (raw && typeof raw === "object") {
      return raw as Record<string, any>;
    }
  }

  if (candidate && typeof candidate === "object" && "result" in candidate) {
    const nested = (candidate as { result?: unknown }).result;
    if (nested && typeof nested === "object") {
      return nested as Record<string, any>;
    }
  }

  if (candidate && typeof candidate === "object") {
    return candidate as Record<string, any>;
  }

  return {};
}

function extractHash(candidate: unknown): string | undefined {
  const result = unwrapTxResult(candidate);
  if (typeof result.hash === "string") {
    return result.hash;
  }

  if (typeof result.tx_json?.hash === "string") {
    return result.tx_json.hash;
  }

  return undefined;
}

function buildBatchPlan(
  claimRecord: PendingClaimRecord,
  returningWallet: string,
  waitlistEntry?: WaitlistEntryRecord | null
): ReturnTicketBatchPlan {
  const ticketReturnTx: Payment = {
    TransactionType: "Payment",
    Account: returningWallet,
    Destination: claimRecord.vendorAddress,
    Amount: {
      mpt_issuance_id: claimRecord.issuanceId,
      value: "1"
    }
  };

  const refundTx: Payment = {
    TransactionType: "Payment",
    Account: claimRecord.vendorAddress,
    Destination: returningWallet,
    Amount: {
      currency: claimRecord.currency,
      issuer: claimRecord.issuerAddress,
      value: claimRecord.amountRlusd
    }
  };

  const transactions: ReturnTicketBatchPlan["transactions"] = [
    { role: "ticket_return", tx: ticketReturnTx },
    { role: "refund", tx: refundTx }
  ];

  if (waitlistEntry?.escrowSequence) {
    transactions.push({
      role: "waitlist_escrow_finish",
      tx: {
        TransactionType: "EscrowFinish",
        Account: claimRecord.vendorAddress,
        Owner: waitlistEntry.escrowOwner,
        OfferSequence: waitlistEntry.escrowSequence
      }
    });
  }

  return {
    batchMode: "ALL_OR_NOTHING",
    transactions
  };
}

export async function returnTicket(input: ReturnTicketInput, mptAssetId: string): Promise<ReturnTicketResult> {
  const runtime = input.runtime;
  const authProvider = runtime?.authProvider ?? mockDidAuthProvider;
  const didVerification = await authProvider.verifyWallet({
    wallet: input.wallet,
    artifact: input.didAuth
  });
  if (!didVerification.verified) {
    throw new Error(didVerification.reason ?? `DID verification failed for wallet ${input.wallet}.`);
  }

  const claimRecord = await runtime?.loadClaimRecord?.(input.ticketId);
  if (!claimRecord) {
    const batchPlan = buildBatchPlan(
      {
        claimId: input.ticketId,
        paymentTxHash: "",
        buyerAddress: input.wallet,
        recipientWallet: input.wallet,
        vendorAddress: input.venueId,
        issuanceId: mptAssetId,
        ticketIndex: 0,
        amountRlusd: "0",
        currency: "USD",
        issuerAddress: "",
        status: "claimed",
        createdAt: new Date().toISOString()
      },
      input.wallet
    );
    return {
      ticketId: input.ticketId,
      returnStatus: "planned",
      batchPlan
    };
  }

  if (claimRecord.recipientWallet !== input.wallet) {
    throw new Error("Claim record wallet does not match the returning wallet.");
  }

  if (claimRecord.status !== "claimed") {
    throw new Error(`Ticket ${input.ticketId} is ${claimRecord.status} and cannot be returned.`);
  }

  const waitlistEntry = await runtime?.loadNextWaitlistEntry?.(claimRecord.vendorAddress);
  const batchPlan = buildBatchPlan(claimRecord, input.wallet, waitlistEntry);

  if (!runtime?.submitReturnBatch) {
    return {
      ticketId: input.ticketId,
      returnStatus: "planned",
      batchPlan,
      claimRecord,
      allocatedWaitlistEntry: waitlistEntry
    };
  }

  const batchResult = await runtime.submitReturnBatch(batchPlan, {
    claimRecord,
    waitlistEntry
  });
  const refundTxHash = extractHash(batchResult.results.refund);
  const waitlistFinishHash = extractHash(batchResult.results.waitlist_escrow_finish);
  await runtime.updateClaimRecord?.(input.ticketId, {
    status: "returned",
    returnedAt: new Date().toISOString(),
    returnBatchHash: batchResult.batchHash,
    refundTxHash,
    waitlistAllocationId: waitlistEntry?.waitlistId
  });

  if (waitlistEntry) {
    await runtime.updateWaitlistEntry?.(waitlistEntry.waitlistId, {
      status: "allocated",
      allocatedAt: new Date().toISOString(),
      ticketId: input.ticketId,
      escrowFinishHash: waitlistFinishHash
    });

    await runtime.persistPendingClaim?.({
      claimId: `${waitlistEntry.waitlistId}:allocated`,
      paymentTxHash: waitlistFinishHash ?? batchResult.batchHash ?? input.ticketId,
      buyerAddress: waitlistEntry.wallet,
      recipientWallet: waitlistEntry.wallet,
      vendorAddress: claimRecord.vendorAddress,
      issuanceId: claimRecord.issuanceId,
      ticketIndex: claimRecord.ticketIndex,
      amountRlusd: claimRecord.amountRlusd,
      currency: claimRecord.currency,
      issuerAddress: claimRecord.issuerAddress,
      status: "pending_authorization",
      createdAt: new Date().toISOString()
    });
  }

  return {
    ticketId: input.ticketId,
    returnStatus: "returned",
    batchPlan,
    claimRecord,
    allocatedWaitlistEntry: waitlistEntry,
    batchResult
  };
}
