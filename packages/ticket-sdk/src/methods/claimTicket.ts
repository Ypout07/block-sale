import type { Payment } from "xrpl";
import {
  mockDidAuthProvider,
  type DidAuthProvider,
  type WalletDidAuth
} from "../oracle/mockDidVerifier.js";

export type PendingClaimRecord = {
  claimId: string;
  paymentTxHash: string;
  buyerAddress: string;
  recipientWallet: string;
  vendorAddress: string;
  issuanceId: string;
  ticketIndex: number;
  amountRlusd: string;
  currency: string;
  issuerAddress: string;
  status: "pending_authorization" | "pending_did_verification" | "claimed" | "redeemed" | "returned";
  createdAt: string;
  claimedAt?: string;
  releasedTxHash?: string;
  redeemedAt?: string;
  redemptionHash?: string;
  returnedAt?: string;
  returnBatchHash?: string;
  refundTxHash?: string;
  waitlistAllocationId?: string;
};

export type ClaimTicketRuntime = {
  xrplClient?: {
    request: (request: Record<string, unknown>) => Promise<{ result: unknown }>;
  };
  authProvider?: DidAuthProvider;
  loadPendingClaim?: (claimId: string) => Promise<PendingClaimRecord | null> | PendingClaimRecord | null;
  submitAuthorization?: (authorizeTx: Record<string, unknown>) => Promise<unknown>;
  submitTicketRelease?: (releaseTx: Payment, pendingClaim: PendingClaimRecord) => Promise<unknown>;
  consumePendingClaim?: (
    claimId: string,
    updates: { status: "claimed"; claimedAt: string; releasedTxHash?: string }
  ) => Promise<void> | void;
};

export type ClaimTicketInput = {
  venueId: string;
  wallet: string;
  ticketId: string;
  didAuth?: WalletDidAuth;
  runtime?: ClaimTicketRuntime;
};

export type ClaimTicketResult = {
  ticketId: string;
  claimStatus: "planned" | "claimed";
  authorizeTx: {
    TransactionType: "MPTokenAuthorize";
    Account: string;
    MPTokenIssuanceID: string;
  };
  pendingClaim?: PendingClaimRecord;
  authorizationResult?: unknown;
  releaseTx?: Payment;
  releaseResult?: unknown;
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

function extractHash(candidate: unknown) {
  const result = unwrapTxResult(candidate);
  if (typeof result.hash === "string") {
    return result.hash;
  }

  if (typeof result.tx_json?.hash === "string") {
    return result.tx_json.hash;
  }

  return undefined;
}

async function isRecipientAuthorized(
  xrplClient: NonNullable<ClaimTicketRuntime["xrplClient"]>,
  recipientWallet: string,
  issuanceId: string
) {
  const response = await xrplClient.request({
    command: "account_objects",
    account: recipientWallet
  });

  const objects = (response.result as { account_objects?: Array<Record<string, unknown>> }).account_objects ?? [];
  return objects.some(
    (entry) => entry.LedgerEntryType === "MPToken" && entry.MPTokenIssuanceID === issuanceId
  );
}

async function requireDidVerification(
  wallet: string,
  artifact: WalletDidAuth | undefined,
  authProvider?: DidAuthProvider
) {
  const result = await (authProvider ?? mockDidAuthProvider).verifyWallet({
    wallet,
    artifact
  });
  if (!result.verified) {
    throw new Error(result.reason ?? `DID verification failed for wallet ${wallet}.`);
  }
  return result;
}

export async function claimTicket(input: ClaimTicketInput, mptAssetId: string): Promise<ClaimTicketResult> {
  const runtime = input.runtime;
  const pendingClaim = await runtime?.loadPendingClaim?.(input.ticketId);
  const issuanceId = pendingClaim?.issuanceId ?? mptAssetId;

  if (!issuanceId) {
    throw new Error("claimTicket requires an MPT issuance ID.");
  }

  const authorizeTx = {
    TransactionType: "MPTokenAuthorize" as const,
    Account: input.wallet,
    MPTokenIssuanceID: issuanceId
  };

  if (!runtime?.loadPendingClaim) {
    await requireDidVerification(input.wallet, input.didAuth, runtime?.authProvider);
    return {
      ticketId: input.ticketId,
      claimStatus: "planned",
      authorizeTx
    };
  }

  if (!pendingClaim) {
    throw new Error(`No pending claim exists for ticket ${input.ticketId}.`);
  }

  if (pendingClaim.recipientWallet !== input.wallet) {
    throw new Error("Pending claim wallet does not match the claiming wallet.");
  }

  if (pendingClaim.status !== "pending_authorization" && pendingClaim.status !== "pending_did_verification") {
    throw new Error(`Pending claim ${input.ticketId} is already ${pendingClaim.status}.`);
  }

  await requireDidVerification(input.wallet, input.didAuth, runtime?.authProvider);

  let authorizationResult: unknown;
  if (runtime.xrplClient) {
    const alreadyAuthorized = await isRecipientAuthorized(runtime.xrplClient, input.wallet, issuanceId);
    if (!alreadyAuthorized) {
      if (!runtime.submitAuthorization) {
        return {
          ticketId: input.ticketId,
          claimStatus: "planned",
          authorizeTx,
          pendingClaim
        };
      }

      authorizationResult = await runtime.submitAuthorization(authorizeTx);
    }
  } else if (runtime.submitAuthorization) {
    authorizationResult = await runtime.submitAuthorization(authorizeTx);
  } else {
    return {
      ticketId: input.ticketId,
      claimStatus: "planned",
      authorizeTx,
      pendingClaim
    };
  }

  if (runtime.xrplClient) {
    const authorized = await isRecipientAuthorized(runtime.xrplClient, input.wallet, issuanceId);
    if (!authorized) {
      throw new Error("Recipient still is not authorized to receive the MPT after claim authorization.");
    }
  }

  if (!runtime.submitTicketRelease) {
    return {
      ticketId: input.ticketId,
      claimStatus: "planned",
      authorizeTx,
      pendingClaim,
      authorizationResult
    };
  }

  const releaseTx: Payment = {
    TransactionType: "Payment",
    Account: pendingClaim.vendorAddress,
    Destination: input.wallet,
    Amount: {
      mpt_issuance_id: issuanceId,
      value: "1"
    }
  };

  const releaseResult = await runtime.submitTicketRelease(releaseTx, pendingClaim);
  const releasedTxHash = extractHash(releaseResult);
  await runtime.consumePendingClaim?.(pendingClaim.claimId, {
    status: "claimed",
    claimedAt: new Date().toISOString(),
    releasedTxHash
  });

  return {
    ticketId: input.ticketId,
    claimStatus: "claimed",
    authorizeTx,
    pendingClaim,
    authorizationResult,
    releaseTx,
    releaseResult
  };
}
