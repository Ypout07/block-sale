import type { Payment } from "xrpl";
import {
  assertPrimaryPurchasePayment,
  type PaymentApproval,
  type PrimaryPurchaseRequirements
} from "../policy/primaryPurchasePolicy.js";
import { verifyDid } from "../oracle/mockDidVerifier.js";

export type BuyGroupTicketRuntime = {
  xrplClient?: {
    request: (request: Record<string, unknown>) => Promise<{ result: unknown }>;
  };
  verifyDidProof?: (wallet: string) => Promise<{ wallet: string; verified: boolean; provider: string }>;
  paymentTxResult?: unknown;
  submitPayment?: (paymentTx: Payment) => Promise<unknown>;
  submitTicketRelease?: (
    releaseTx: Payment,
    context: { recipientWallet: string; ticketIndex: number }
  ) => Promise<unknown>;
  persistPendingClaim?: (pendingClaim: PendingTicketClaim) => Promise<void> | void;
};

export type BuyGroupTicketInput = {
  venueId: string;
  payerWallet: string;
  recipients: string[];
  amountRlusd: number;
  runtime?: BuyGroupTicketRuntime;
};

export type TicketReleaseInstruction = {
  recipientWallet: string;
  ticketIndex: number;
  ticketTx: Payment;
};

export type BuyGroupTicketPlan = {
  purchaseMode: "solo" | "group";
  groupSize: number;
  recipients: string[];
  paymentTx: Payment;
  paymentRequirements: Omit<PrimaryPurchaseRequirements, "paymentTxHash">;
  ticketReleaseInstructions: TicketReleaseInstruction[];
};

export type VerifiedGroupTicketPurchase = {
  approval: PaymentApproval;
  releaseInstructions: TicketReleaseInstruction[];
};

export type GroupTicketRecipientResult = {
  recipientWallet: string;
  ticketIndex: number;
  status: "delivered" | "pending_authorization" | "pending_did_verification" | "ready_to_release" | "release_failed";
  lifecycleState: "sold" | "pending_authorization" | "pending_did_verification" | "claimed";
  reason?: string;
  authorizationVerified: boolean;
  didVerified: boolean;
  pendingClaimId?: string;
  releaseTx?: Payment;
  releaseResult?: unknown;
};

export type PendingTicketClaim = {
  claimId: string;
  paymentTxHash: string;
  buyerAddress: string;
  recipientWallet: string;
  vendorAddress: string;
  issuanceId: string;
  ticketIndex: number;
  amountRlusd: string;
  status: "pending_authorization" | "pending_did_verification";
  createdAt: string;
};

export type BuyGroupTicketResult = BuyGroupTicketPlan & {
  paymentStatus: "planned" | "submitted" | "verified";
  paymentResult?: unknown;
  approval?: PaymentApproval;
  deliveredRecipients: GroupTicketRecipientResult[];
  pendingRecipients: GroupTicketRecipientResult[];
  failedRecipients: GroupTicketRecipientResult[];
};

function hexFromUtf8(value: string) {
  return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeRecipients(input: BuyGroupTicketInput) {
  const recipients = input.recipients.map((recipient) => recipient.trim()).filter(Boolean);
  if (recipients.length === 0) {
    throw new Error("At least one recipient wallet is required.");
  }

  if (recipients.some((recipient) => !recipient.startsWith("r"))) {
    throw new Error("Recipients must be XRPL classic addresses.");
  }

  if (!input.payerWallet.trim().startsWith("r")) {
    throw new Error("payerWallet must be an XRPL classic address.");
  }

  if (!input.venueId.trim().startsWith("r")) {
    throw new Error("venueId must be the vendor XRPL classic address.");
  }

  if (!Number.isFinite(input.amountRlusd) || input.amountRlusd <= 0) {
    throw new Error("amountRlusd must be a positive number.");
  }

  return recipients;
}

function buildTicketReleaseInstructions(
  venueId: string,
  recipients: string[],
  mptAssetId?: string
): TicketReleaseInstruction[] {
  if (!mptAssetId) {
    return [];
  }

  return recipients.map((recipientWallet, index) => ({
    recipientWallet,
    ticketIndex: index,
    ticketTx: {
      TransactionType: "Payment",
      Account: venueId,
      Destination: recipientWallet,
      Amount: {
        mpt_issuance_id: mptAssetId,
        value: "1"
      }
    }
  }));
}

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

function isSuccessfulTx(candidate: unknown) {
  const result = unwrapTxResult(candidate);
  if (result.accepted === true) {
    return true;
  }

  return result.transactionResult === "tesSUCCESS" || result.meta?.TransactionResult === "tesSUCCESS";
}

async function isRecipientAuthorized(
  xrplClient: NonNullable<BuyGroupTicketRuntime["xrplClient"]>,
  recipientWallet: string,
  mptAssetId: string
) {
  const response = await xrplClient.request({
    command: "account_objects",
    account: recipientWallet
  });

  const objects = (response.result as { account_objects?: Array<Record<string, unknown>> }).account_objects ?? [];
  return objects.some(
    (entry) => entry.LedgerEntryType === "MPToken" && entry.MPTokenIssuanceID === mptAssetId
  );
}

async function requireDidVerification(
  wallet: string,
  verifyDidProof?: (wallet: string) => Promise<{ wallet: string; verified: boolean; provider: string }>
) {
  const result = verifyDidProof ? await verifyDidProof(wallet) : await verifyDid(wallet);
  if (!result.verified) {
    throw new Error(`DID verification failed for wallet ${wallet}.`);
  }
  return result;
}

function buildPlan(input: BuyGroupTicketInput, rlusdIssuer: string, mptAssetId?: string): BuyGroupTicketPlan {
  const recipients = normalizeRecipients(input);
  const recipientsData = hexFromUtf8(JSON.stringify(recipients));

  const paymentTx: Payment = {
    TransactionType: "Payment",
    Account: input.payerWallet,
    Destination: input.venueId,
    Amount: {
      currency: "USD",
      value: input.amountRlusd.toString(),
      issuer: rlusdIssuer
    },
    Memos: [
      {
        Memo: {
          MemoType: hexFromUtf8("GroupTicketRecipients"),
          MemoFormat: hexFromUtf8("application/json"),
          MemoData: recipientsData
        }
      },
      {
        Memo: {
          MemoType: hexFromUtf8("PurchaseMode"),
          MemoData: hexFromUtf8(recipients.length === 1 ? "solo" : "group")
        }
      }
    ]
  };

  return {
    purchaseMode: recipients.length === 1 ? "solo" : "group",
    groupSize: recipients.length,
    recipients,
    paymentTx,
    paymentRequirements: {
      buyerAddress: input.payerWallet,
      vendorAddress: input.venueId,
      issuerAddress: rlusdIssuer,
      minimumAmount: input.amountRlusd.toString(),
      currency: "USD"
    },
    ticketReleaseInstructions: buildTicketReleaseInstructions(input.venueId, recipients, mptAssetId)
  };
}

function buildPendingClaimId(paymentTxHash: string, recipientWallet: string, ticketIndex: number) {
  return `${paymentTxHash}:${recipientWallet}:${ticketIndex}`;
}

export function verifyGroupTicketPurchase(
  plan: BuyGroupTicketPlan,
  paymentTxResult: unknown
): VerifiedGroupTicketPurchase {
  const paymentTxHash = extractHash(paymentTxResult);
  if (!paymentTxHash) {
    throw new Error("A validated XRPL payment result with a transaction hash is required.");
  }

  const approval = assertPrimaryPurchasePayment(unwrapTxResult(paymentTxResult), {
    paymentTxHash,
    ...plan.paymentRequirements
  });

  return {
    approval,
    releaseInstructions: plan.ticketReleaseInstructions
  };
}

export async function buyGroupTicket(
  input: BuyGroupTicketInput,
  rlusdIssuer: string,
  mptAssetId?: string
): Promise<BuyGroupTicketResult> {
  const plan = buildPlan(input, rlusdIssuer, mptAssetId);
  const runtime = input.runtime;

  if (!runtime?.paymentTxResult && !runtime?.submitPayment) {
    return {
      ...plan,
      paymentStatus: "planned",
      deliveredRecipients: [],
      pendingRecipients: plan.ticketReleaseInstructions.map((instruction) => ({
        recipientWallet: instruction.recipientWallet,
        ticketIndex: instruction.ticketIndex,
        status: "ready_to_release",
        lifecycleState: "pending_authorization",
        reason: "Payment has not been submitted yet.",
        authorizationVerified: false,
        didVerified: false,
        releaseTx: instruction.ticketTx
      })),
      failedRecipients: []
    };
  }

  await requireDidVerification(input.payerWallet, runtime?.verifyDidProof);

  const paymentResult = runtime.paymentTxResult ?? (await runtime.submitPayment?.(plan.paymentTx));
  if (!paymentResult) {
    throw new Error("Payment execution was requested but no payment result was returned.");
  }

  const verified = verifyGroupTicketPurchase(plan, paymentResult);
  const deliveredRecipients: GroupTicketRecipientResult[] = [];
  const pendingRecipients: GroupTicketRecipientResult[] = [];
  const failedRecipients: GroupTicketRecipientResult[] = [];

  for (const instruction of verified.releaseInstructions) {
    if (!mptAssetId) {
      pendingRecipients.push({
        recipientWallet: instruction.recipientWallet,
        ticketIndex: instruction.ticketIndex,
        status: "ready_to_release",
        lifecycleState: "pending_authorization",
        reason: "MPT asset ID is not configured yet.",
        authorizationVerified: false,
        didVerified: false,
        releaseTx: instruction.ticketTx
      });
      continue;
    }

    if (!runtime.xrplClient) {
      pendingRecipients.push({
        recipientWallet: instruction.recipientWallet,
        ticketIndex: instruction.ticketIndex,
        status: "ready_to_release",
        lifecycleState: "pending_authorization",
        reason: "Recipient authorization could not be checked because no XRPL client was provided.",
        authorizationVerified: false,
        didVerified: false,
        releaseTx: instruction.ticketTx
      });
      continue;
    }

    const didVerification = await (runtime.verifyDidProof
      ? runtime.verifyDidProof(instruction.recipientWallet)
      : verifyDid(instruction.recipientWallet));
    if (!didVerification.verified) {
      const pendingClaimId = buildPendingClaimId(
        verified.approval.paymentTxHash,
        instruction.recipientWallet,
        instruction.ticketIndex
      );
      const pendingClaim: PendingTicketClaim = {
        claimId: pendingClaimId,
        paymentTxHash: verified.approval.paymentTxHash,
        buyerAddress: verified.approval.buyerAddress,
        recipientWallet: instruction.recipientWallet,
        vendorAddress: verified.approval.vendorAddress,
        issuanceId: mptAssetId,
        ticketIndex: instruction.ticketIndex,
        amountRlusd: verified.approval.deliveredAmount,
        status: "pending_did_verification",
        createdAt: new Date().toISOString()
      };
      await runtime.persistPendingClaim?.(pendingClaim);
      pendingRecipients.push({
        recipientWallet: instruction.recipientWallet,
        ticketIndex: instruction.ticketIndex,
        status: "pending_did_verification",
        lifecycleState: "pending_did_verification",
        reason: "Recipient must complete DID verification before delivery.",
        authorizationVerified: false,
        didVerified: false,
        pendingClaimId,
        releaseTx: instruction.ticketTx
      });
      continue;
    }

    const authorized = await isRecipientAuthorized(runtime.xrplClient, instruction.recipientWallet, mptAssetId);
    if (!authorized) {
      const pendingClaimId = buildPendingClaimId(
        verified.approval.paymentTxHash,
        instruction.recipientWallet,
        instruction.ticketIndex
      );
      const pendingClaim: PendingTicketClaim = {
        claimId: pendingClaimId,
        paymentTxHash: verified.approval.paymentTxHash,
        buyerAddress: verified.approval.buyerAddress,
        recipientWallet: instruction.recipientWallet,
        vendorAddress: verified.approval.vendorAddress,
        issuanceId: mptAssetId,
        ticketIndex: instruction.ticketIndex,
        amountRlusd: verified.approval.deliveredAmount,
        status: "pending_authorization",
        createdAt: new Date().toISOString()
      };
      await runtime.persistPendingClaim?.(pendingClaim);
      pendingRecipients.push({
        recipientWallet: instruction.recipientWallet,
        ticketIndex: instruction.ticketIndex,
        status: "pending_authorization",
        lifecycleState: "pending_authorization",
        reason: "Recipient must complete MPTokenAuthorize before delivery.",
        authorizationVerified: true,
        didVerified: true,
        pendingClaimId,
        releaseTx: instruction.ticketTx
      });
      continue;
    }

    if (!runtime.submitTicketRelease) {
      pendingRecipients.push({
        recipientWallet: instruction.recipientWallet,
        ticketIndex: instruction.ticketIndex,
        status: "ready_to_release",
        lifecycleState: "pending_authorization",
        reason: "Recipient is authorized, but no vendor release executor was provided.",
        authorizationVerified: true,
        didVerified: true,
        releaseTx: instruction.ticketTx
      });
      continue;
    }

    const releaseResult = await runtime.submitTicketRelease(instruction.ticketTx, {
      recipientWallet: instruction.recipientWallet,
      ticketIndex: instruction.ticketIndex
    });

    const recipientResult: GroupTicketRecipientResult = {
      recipientWallet: instruction.recipientWallet,
      ticketIndex: instruction.ticketIndex,
      status: isSuccessfulTx(releaseResult) ? "delivered" : "release_failed",
      lifecycleState: isSuccessfulTx(releaseResult) ? "claimed" : "pending_authorization",
      authorizationVerified: true,
      didVerified: true,
      releaseTx: instruction.ticketTx,
      releaseResult
    };

    if (recipientResult.status === "delivered") {
      deliveredRecipients.push(recipientResult);
    } else {
      recipientResult.reason = "Vendor release submission failed.";
      failedRecipients.push(recipientResult);
    }
  }

  return {
    ...plan,
    paymentStatus: "verified",
    paymentResult,
    approval: verified.approval,
    deliveredRecipients,
    pendingRecipients,
    failedRecipients
  };
}
