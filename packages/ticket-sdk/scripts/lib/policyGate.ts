import fs from "node:fs";
import path from "node:path";
import {
  assertPrimaryPurchasePayment,
  type PaymentApproval
} from "../../src/policy/primaryPurchasePolicy.ts";
import type { PendingClaimRecord } from "../../src/methods/claimTicket.ts";
import {
  submitTx,
  type SubmittedTx
} from "./primaryFlow.ts";

type ConsumedApprovalRecord = {
  consumedAt: string;
  paymentTxHash: string;
  buyerAddress: string;
  releasedTxHash?: string;
};

type PolicyState = {
  approvals: Record<string, ConsumedApprovalRecord>;
  pendingClaims: Record<string, PendingClaimRecord>;
};

function statePath() {
  return path.resolve(import.meta.dirname, "..", "..", "..", "..", "contracts", "build", "primary-policy-state.json");
}

function loadState(filePath = statePath()): PolicyState {
  if (!fs.existsSync(filePath)) {
    return { approvals: {}, pendingClaims: {} };
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as PolicyState;
}

function saveState(state: PolicyState, filePath = statePath()) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export function resetPolicyState() {
  saveState({ approvals: {}, pendingClaims: {} });
}

export function getPolicyStatePath() {
  return statePath();
}

export async function fetchPrimaryApproval(
  client: { request: (request: Record<string, unknown>) => Promise<{ result: unknown }> },
  requirements: {
    paymentTxHash: string;
    buyerAddress: string;
    vendorAddress: string;
    issuerAddress: string;
    minimumAmount: string;
    currency?: string;
  }
) {
  const response = await client.request({
    command: "tx",
    transaction: requirements.paymentTxHash
  });

  return assertPrimaryPurchasePayment(response.result, requirements);
}

export function consumeApproval(approval: PaymentApproval, releasedTxHash?: string) {
  const state = loadState();
  if (state.approvals[approval.approvalKey]) {
    throw new Error("Primary purchase approval has already been consumed.");
  }

  state.approvals[approval.approvalKey] = {
    consumedAt: new Date().toISOString(),
    paymentTxHash: approval.paymentTxHash,
    buyerAddress: approval.buyerAddress,
    releasedTxHash
  };
  saveState(state);
}

export function storePendingClaim(pendingClaim: PendingClaimRecord) {
  const state = loadState();
  state.pendingClaims[pendingClaim.claimId] = pendingClaim;
  saveState(state);
}

export function loadPendingClaim(claimId: string): PendingClaimRecord | null {
  const state = loadState();
  return state.pendingClaims[claimId] ?? null;
}

export function consumePendingClaim(
  claimId: string,
  updates: { status: "claimed"; claimedAt: string; releasedTxHash?: string }
) {
  const state = loadState();
  const pendingClaim = state.pendingClaims[claimId];
  if (!pendingClaim) {
    throw new Error(`Pending claim ${claimId} was not found.`);
  }

  if (pendingClaim.status !== "pending_authorization" && pendingClaim.status !== "pending_did_verification") {
    throw new Error(`Pending claim ${claimId} is already ${pendingClaim.status}.`);
  }

  state.pendingClaims[claimId] = {
    ...pendingClaim,
    status: updates.status,
    claimedAt: updates.claimedAt,
    releasedTxHash: updates.releasedTxHash
  };
  saveState(state);
}

export function updateClaimRecord(
  claimId: string,
  updates:
    | { status: "claimed"; claimedAt: string; releasedTxHash?: string }
    | { status: "redeemed"; redeemedAt: string; redemptionHash: string }
) {
  const state = loadState();
  const pendingClaim = state.pendingClaims[claimId];
  if (!pendingClaim) {
    throw new Error(`Pending claim ${claimId} was not found.`);
  }

  if (updates.status === "claimed") {
    if (pendingClaim.status !== "pending_authorization" && pendingClaim.status !== "pending_did_verification") {
      throw new Error(`Pending claim ${claimId} is already ${pendingClaim.status}.`);
    }

    state.pendingClaims[claimId] = {
      ...pendingClaim,
      status: updates.status,
      claimedAt: updates.claimedAt,
      releasedTxHash: updates.releasedTxHash
    };
  } else {
    if (pendingClaim.status !== "claimed") {
      throw new Error(`Pending claim ${claimId} is ${pendingClaim.status} and cannot be redeemed.`);
    }

    state.pendingClaims[claimId] = {
      ...pendingClaim,
      status: updates.status,
      redeemedAt: updates.redeemedAt,
      redemptionHash: updates.redemptionHash
    };
  }

  saveState(state);
}

export async function releaseTicketUnderPolicy(input: {
  client: any;
  vendorWallet: any;
  buyerAddress: string;
  issuanceId: string;
  approval: PaymentApproval;
  label: string;
}) {
  const state = loadState();
  if (state.approvals[input.approval.approvalKey]) {
    throw new Error("Primary purchase approval has already been consumed.");
  }

  if (input.approval.buyerAddress !== input.buyerAddress) {
    throw new Error("Approval buyer does not match the requested ticket recipient.");
  }

  const tx = await submitTx(
    input.client,
    input.vendorWallet,
    {
      TransactionType: "Payment",
      Account: input.vendorWallet.address,
      Destination: input.buyerAddress,
      Amount: {
        mpt_issuance_id: input.issuanceId,
        value: "1"
      }
    },
    input.label
  );

  consumeApproval(input.approval, tx.hash);
  return tx;
}

export function rejectUnapprovedRelease(reason: string): SubmittedTx {
  return {
    label: "Policy rejected release",
    transactionResult: "policy_rejected",
    accepted: false,
    hookExecutions: [],
    raw: { reason }
  };
}
