import type { PendingClaimRecord } from "../methods/claimTicket.js";
import type { WaitlistEntryRecord } from "../methods/joinWaitlist.js";

export type PolicyEvent =
  | {
      entity: "claim";
      action: "created";
      claim: PendingClaimRecord;
    }
  | {
      entity: "claim";
      action: "status";
      claimId: string;
      updates: Record<string, unknown>;
    }
  | {
      entity: "waitlist";
      action: "status";
      waitlistId: string;
      updates: Record<string, unknown>;
    };

export type RedemptionMarker = {
  entity: "redemption";
  ticketId: string;
  wallet: string;
  venueId: string;
  issuanceId: string;
  qrHash: string;
  redeemedAt: string;
};

export type LedgerClient = {
  request: (request: Record<string, unknown>) => Promise<{ result: unknown }>;
};

export type OnLedgerStateRuntime = {
  reset: () => Promise<void>;
  persistPendingClaim: (claim: PendingClaimRecord) => Promise<void>;
  loadPendingClaim: (claimId: string) => Promise<PendingClaimRecord | null>;
  listPendingClaims: (recipientWallet?: string) => Promise<PendingClaimRecord[]>;
  consumePendingClaim: (
    claimId: string,
    updates: { status: "claimed"; claimedAt: string; releasedTxHash?: string }
  ) => Promise<void>;
  updateClaimRecord: (claimId: string, updates: Record<string, unknown>) => Promise<void>;
  persistWaitlistEntry: (_entry: WaitlistEntryRecord) => Promise<void>;
  loadWaitlistEntry: (waitlistId: string) => Promise<WaitlistEntryRecord | null>;
  listWaitlistEntries: (filter?: { wallet?: string; venueId?: string; eventId?: string }) => Promise<WaitlistEntryRecord[]>;
  getNextActiveWaitlistEntry: (venueId: string) => Promise<WaitlistEntryRecord | null>;
  updateWaitlistEntry: (waitlistId: string, updates: Record<string, unknown>) => Promise<void>;
};

type CreateOnLedgerStateRuntimeInput = {
  xrplClient: LedgerClient;
  stateAccount: string;
  escrowVaultAccount: string;
  submitStateEvent: (event: PolicyEvent, label: string) => Promise<unknown>;
};

function utf8ToHex(value: string) {
  return Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function hexToUtf8(value: string) {
  const bytes = value.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [];
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function buildOnLedgerStateMemos(event: PolicyEvent) {
  return [
    {
      Memo: {
        MemoType: utf8ToHex("PolicyEvent"),
        MemoFormat: utf8ToHex("application/json"),
        MemoData: utf8ToHex(JSON.stringify(event))
      }
    }
  ];
}

export function buildOnLedgerRedemptionMemos(marker: RedemptionMarker) {
  return [
    {
      Memo: {
        MemoType: utf8ToHex("TicketRedemption"),
        MemoFormat: utf8ToHex("application/json"),
        MemoData: utf8ToHex(JSON.stringify(marker))
      }
    }
  ];
}

function parseMemoJson(tx: Record<string, any>, memoType: string) {
  const memos = Array.isArray(tx.Memos) ? tx.Memos : [];
  for (const entry of memos) {
    const memo = entry?.Memo;
    if (!memo?.MemoType || !memo?.MemoData) {
      continue;
    }

    try {
      const decodedType = hexToUtf8(String(memo.MemoType));
      if (decodedType !== memoType) {
        continue;
      }

      return JSON.parse(hexToUtf8(String(memo.MemoData))) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function xrplDateToIso(date: unknown) {
  if (typeof date !== "number" || !Number.isFinite(date)) {
    return new Date().toISOString();
  }
  return new Date((date + 946684800) * 1000).toISOString();
}

async function fetchAccountTransactions(client: LedgerClient, account: string, limit = 200) {
  const response = await client.request({
    command: "account_tx",
    account,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit
  });

  const transactions = (response.result as { transactions?: Array<Record<string, any>> }).transactions ?? [];
  return [...transactions].sort((left, right) => {
    const leftLedger = Number(left.tx?.ledger_index ?? left.tx_json?.ledger_index ?? 0);
    const rightLedger = Number(right.tx?.ledger_index ?? right.tx_json?.ledger_index ?? 0);
    return leftLedger - rightLedger;
  });
}

export function createOnLedgerStateRuntime(
  input: CreateOnLedgerStateRuntimeInput
): OnLedgerStateRuntime {
  const { xrplClient, stateAccount, escrowVaultAccount, submitStateEvent } = input;

  async function loadAllClaims() {
    const transactions = await fetchAccountTransactions(xrplClient, stateAccount);
    const claims = new Map<string, PendingClaimRecord>();

    for (const entry of transactions) {
      const tx = entry.tx ?? entry.tx_json ?? {};
      const memo = parseMemoJson(tx, "PolicyEvent") as PolicyEvent | null;
      if (memo?.entity === "claim") {
        if (memo.action === "created") {
          claims.set(memo.claim.claimId, { ...memo.claim });
          continue;
        }

        if (memo.action === "status") {
          const existing = claims.get(memo.claimId);
          if (existing) {
            claims.set(
              memo.claimId,
              {
                ...existing,
                ...memo.updates
              } as PendingClaimRecord
            );
          }
        }
      }

      const redemptionMemo = parseMemoJson(tx, "TicketRedemption") as RedemptionMarker | null;
      if (redemptionMemo) {
        const existing = claims.get(redemptionMemo.ticketId);
        if (existing) {
          claims.set(
            redemptionMemo.ticketId,
            {
              ...existing,
              status: "redeemed",
              redeemedAt: redemptionMemo.redeemedAt,
              redemptionHash: redemptionMemo.qrHash,
              redemptionTxHash: typeof tx.hash === "string" ? tx.hash : undefined
            } as PendingClaimRecord
          );
        }
      }
    }

    return [...claims.values()];
  }

  async function loadAllWaitlistEntries() {
    const escrowTransactions = await fetchAccountTransactions(xrplClient, escrowVaultAccount);
    const entries = new Map<string, WaitlistEntryRecord>();

    for (const entry of escrowTransactions) {
      const tx = entry.tx ?? entry.tx_json ?? {};
      if (tx.TransactionType !== "EscrowCreate") {
        continue;
      }

      const memo = parseMemoJson(tx, "WaitlistEntry");
      if (!memo?.waitlistId || !memo?.venueId) {
        continue;
      }

      entries.set(String(memo.waitlistId), {
        waitlistId: String(memo.waitlistId),
        venueId: String(memo.venueId),
        eventId: typeof memo.eventId === "string" ? memo.eventId : undefined,
        escrowDestination: String(tx.Destination),
        wallet: String(tx.Account),
        depositDrops: String(tx.Amount),
        status: "active",
        escrowOwner: String(tx.Account),
        escrowSequence: Number(tx.Sequence),
        escrowTxHash: typeof tx.hash === "string" ? tx.hash : undefined,
        createdAt: xrplDateToIso(tx.date),
        activatedAt: xrplDateToIso(tx.date),
        finishAfter: Number(tx.FinishAfter),
        cancelAfter: Number(tx.CancelAfter)
      });
    }

    const stateTransactions = await fetchAccountTransactions(xrplClient, stateAccount);
    for (const entry of stateTransactions) {
      const tx = entry.tx ?? entry.tx_json ?? {};
      const memo = parseMemoJson(tx, "PolicyEvent") as PolicyEvent | null;
      if (!memo || memo.entity !== "waitlist") {
        continue;
      }

      const existing = entries.get(memo.waitlistId);
      if (existing) {
        entries.set(
          memo.waitlistId,
          {
            ...existing,
            ...memo.updates
          } as WaitlistEntryRecord
        );
      }
    }

    return [...entries.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async function persistPendingClaim(claim: PendingClaimRecord) {
    await submitStateEvent(
      {
        entity: "claim",
        action: "created",
        claim
      },
      `Policy Event: Create Pending Claim ${claim.claimId}`
    );
  }

  async function loadPendingClaim(claimId: string): Promise<PendingClaimRecord | null> {
    const claims = await loadAllClaims();
    return claims.find((claim) => claim.claimId === claimId) ?? null;
  }

  async function listPendingClaims(recipientWallet?: string): Promise<PendingClaimRecord[]> {
    const claims = await loadAllClaims();
    return recipientWallet
      ? claims.filter((claim) => claim.recipientWallet === recipientWallet)
      : claims;
  }

  async function updateClaimRecord(claimId: string, updates: Record<string, unknown>) {
    await submitStateEvent(
      {
        entity: "claim",
        action: "status",
        claimId,
        updates
      },
      `Policy Event: Update Claim ${claimId}`
    );
  }

  async function consumePendingClaim(
    claimId: string,
    updates: { status: "claimed"; claimedAt: string; releasedTxHash?: string }
  ) {
    await updateClaimRecord(claimId, updates);
  }

  async function loadWaitlistEntry(waitlistId: string): Promise<WaitlistEntryRecord | null> {
    const entries = await loadAllWaitlistEntries();
    return entries.find((entry) => entry.waitlistId === waitlistId) ?? null;
  }

  async function listWaitlistEntries(filter: {
    wallet?: string;
    venueId?: string;
    eventId?: string;
  } = {}): Promise<WaitlistEntryRecord[]> {
    const entries = await loadAllWaitlistEntries();
    return entries.filter((entry) => {
      if (filter.wallet && entry.wallet !== filter.wallet) {
        return false;
      }
      if (filter.venueId && entry.venueId !== filter.venueId) {
        return false;
      }
      if (filter.eventId && entry.eventId !== filter.eventId) {
        return false;
      }
      return true;
    });
  }

  async function getNextActiveWaitlistEntry(venueId: string): Promise<WaitlistEntryRecord | null> {
    const active = (await loadAllWaitlistEntries())
      .filter((entry) => entry.venueId === venueId)
      .filter((entry) => entry.status === "active")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return active[0] ?? null;
  }

  async function persistWaitlistEntry(_entry: WaitlistEntryRecord) {
    // Canonical waitlist creation is derived from EscrowCreate memos.
  }

  async function updateWaitlistEntry(waitlistId: string, updates: Record<string, unknown>) {
    await submitStateEvent(
      {
        entity: "waitlist",
        action: "status",
        waitlistId,
        updates
      },
      `Policy Event: Update Waitlist ${waitlistId}`
    );
  }

  async function reset() {
    // No local state to clear.
  }

  return {
    reset,
    persistPendingClaim,
    loadPendingClaim,
    listPendingClaims,
    consumePendingClaim,
    updateClaimRecord,
    persistWaitlistEntry,
    loadWaitlistEntry,
    listWaitlistEntries,
    getNextActiveWaitlistEntry,
    updateWaitlistEntry
  };
}
