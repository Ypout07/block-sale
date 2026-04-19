import type { BuyGroupTicketRuntime } from "../methods/buyGroupTicket.js";
import type { ClaimTicketRuntime } from "../methods/claimTicket.js";
import type { JoinWaitlistRuntime } from "../methods/joinWaitlist.js";
import type { RedeemTicketRuntime } from "../methods/redeemTicket.js";
import type { ReturnTicketRuntime } from "../methods/returnTicket.js";
import type { OnLedgerStateRuntime } from "./onLedgerState.js";

export type OnLedgerProtocolSubmitters = {
  submitRedemptionMarker?: RedeemTicketRuntime["submitRedemptionMarker"];
};

export type OnLedgerProtocolRuntime = {
  state: OnLedgerStateRuntime;
  forBuyGiftTickets: (runtime?: BuyGroupTicketRuntime) => BuyGroupTicketRuntime;
  forJoinWaitlist: (runtime?: JoinWaitlistRuntime) => JoinWaitlistRuntime;
  forClaimTicket: (runtime?: ClaimTicketRuntime) => ClaimTicketRuntime;
  forReturnTicket: (runtime?: ReturnTicketRuntime) => ReturnTicketRuntime;
  forRedeemTicket: (runtime?: RedeemTicketRuntime) => RedeemTicketRuntime;
};

export function createOnLedgerProtocolRuntime(
  state: OnLedgerStateRuntime,
  submitters: OnLedgerProtocolSubmitters = {}
): OnLedgerProtocolRuntime {
  return {
    state,
    forBuyGiftTickets(runtime = {}) {
      return {
        ...runtime,
        persistPendingClaim: runtime.persistPendingClaim ?? state.persistPendingClaim
      };
    },
    forJoinWaitlist(runtime = {}) {
      return {
        ...runtime,
        persistWaitlistEntry: runtime.persistWaitlistEntry ?? state.persistWaitlistEntry
      };
    },
    forClaimTicket(runtime = {}) {
      return {
        ...runtime,
        loadPendingClaim: runtime.loadPendingClaim ?? state.loadPendingClaim,
        consumePendingClaim: runtime.consumePendingClaim ?? state.consumePendingClaim
      };
    },
    forReturnTicket(runtime = {}) {
      return {
        ...runtime,
        loadClaimRecord: runtime.loadClaimRecord ?? state.loadPendingClaim,
        loadNextWaitlistEntry: runtime.loadNextWaitlistEntry ?? state.getNextActiveWaitlistEntry,
        updateClaimRecord: runtime.updateClaimRecord ?? state.updateClaimRecord,
        updateWaitlistEntry: runtime.updateWaitlistEntry ?? state.updateWaitlistEntry,
        persistPendingClaim: runtime.persistPendingClaim ?? state.persistPendingClaim
      };
    },
    forRedeemTicket(runtime = {}) {
      return {
        ...runtime,
        loadPendingClaim: runtime.loadPendingClaim ?? state.loadPendingClaim,
        updateClaimRecord: runtime.updateClaimRecord ?? state.updateClaimRecord,
        submitRedemptionMarker: runtime.submitRedemptionMarker ?? submitters.submitRedemptionMarker
      };
    }
  };
}
