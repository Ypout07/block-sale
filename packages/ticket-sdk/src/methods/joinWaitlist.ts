import {
  mockDidAuthProvider,
  type DidAuthProvider,
  type WalletDidAuth
} from "../oracle/mockDidVerifier.js";

export type WaitlistEntryRecord = {
  waitlistId: string;
  venueId: string;
  eventId?: string;
  escrowDestination: string;
  wallet: string;
  depositDrops: string;
  status: "planned" | "active" | "allocated" | "returned" | "expired";
  escrowOwner: string;
  escrowSequence?: number;
  escrowTxHash?: string;
  escrowFinishHash?: string;
  createdAt: string;
  activatedAt?: string;
  allocatedAt?: string;
  returnedAt?: string;
  expiredAt?: string;
  finishAfter: number;
  cancelAfter: number;
  ticketId?: string;
};

export type JoinWaitlistRuntime = {
  authProvider?: DidAuthProvider;
  now?: () => Date;
  submitEscrow?: (escrowTx: Record<string, unknown>) => Promise<unknown>;
  persistWaitlistEntry?: (entry: WaitlistEntryRecord) => Promise<void> | void;
};

export type JoinWaitlistInput = {
  venueId: string;
  eventId?: string;
  wallet: string;
  depositDrops: string;
  didAuth: WalletDidAuth;
  escrowDestination?: string;
  waitSeconds?: number;
  runtime?: JoinWaitlistRuntime;
};

export type JoinWaitlistResult = {
  waitlistId: string;
  escrowStatus: "planned" | "active";
  escrowTx: Record<string, unknown>;
  waitlistEntry: WaitlistEntryRecord;
  escrowResult?: unknown;
};

function rippleTimeFromDate(date: Date) {
  return Math.floor(date.getTime() / 1000) - 946684800;
}

function hexFromUtf8(value: string) {
  return Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
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

function extractSequence(candidate: unknown): number | undefined {
  const result = unwrapTxResult(candidate);
  const sequence = result.tx_json?.Sequence ?? result.Sequence;
  return typeof sequence === "number" ? sequence : undefined;
}

export async function joinWaitlist(input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
  if (!input.wallet.startsWith("r") || !input.venueId.startsWith("r")) {
    throw new Error("joinWaitlist requires XRPL classic addresses for wallet and venueId.");
  }
  if (input.escrowDestination && !input.escrowDestination.startsWith("r")) {
    throw new Error("escrowDestination must be an XRPL classic address when provided.");
  }

  const depositDrops = Number(input.depositDrops);
  if (!Number.isFinite(depositDrops) || depositDrops <= 0) {
    throw new Error("depositDrops must be a positive XRP drop amount.");
  }

  const authProvider = input.runtime?.authProvider ?? mockDidAuthProvider;
  const didVerification = await authProvider.verifyWallet({
    wallet: input.wallet,
    artifact: input.didAuth
  });
  if (!didVerification.verified) {
    throw new Error(didVerification.reason ?? "DID verification failed for waitlist enrollment.");
  }

  const now = input.runtime?.now?.() ?? new Date();
  const waitSeconds = input.waitSeconds ?? 15 * 60;
  const finishAfter = rippleTimeFromDate(now);
  const cancelAfter = rippleTimeFromDate(new Date(now.getTime() + waitSeconds * 1000));
  const waitlistId = `${input.venueId}:${input.wallet}:${now.toISOString()}`;
  const escrowDestination = input.escrowDestination ?? input.venueId;
  const escrowTx = {
    TransactionType: "EscrowCreate",
    Account: input.wallet,
    Destination: escrowDestination,
    Amount: input.depositDrops,
    FinishAfter: finishAfter,
    CancelAfter: cancelAfter,
    Memos: [
      {
        Memo: {
          MemoType: hexFromUtf8("WaitlistEntry"),
          MemoFormat: hexFromUtf8("application/json"),
          MemoData: hexFromUtf8(
            JSON.stringify({
              waitlistId,
              venueId: input.venueId,
              eventId: input.eventId
            })
          )
        }
      }
    ]
  };

  const waitlistEntry: WaitlistEntryRecord = {
    waitlistId,
    venueId: input.venueId,
    eventId: input.eventId,
    escrowDestination,
    wallet: input.wallet,
    depositDrops: input.depositDrops,
    status: input.runtime?.submitEscrow ? "active" : "planned",
    escrowOwner: input.wallet,
    createdAt: now.toISOString(),
    finishAfter,
    cancelAfter
  };

  if (!input.runtime?.submitEscrow) {
    return {
      waitlistId,
      escrowStatus: "planned",
      escrowTx,
      waitlistEntry
    };
  }

  const escrowResult = await input.runtime.submitEscrow(escrowTx);
  const activeEntry: WaitlistEntryRecord = {
    ...waitlistEntry,
    status: "active",
    escrowTxHash: extractHash(escrowResult),
    escrowSequence: extractSequence(escrowResult),
    activatedAt: new Date().toISOString()
  };
  await input.runtime.persistWaitlistEntry?.(activeEntry);

  return {
    waitlistId,
    escrowStatus: "active",
    escrowTx,
    waitlistEntry: activeEntry,
    escrowResult
  };
}
