import type { RedeemTicketRuntime } from "../methods/redeemTicket.js";
import {
  createOnLedgerStateRuntime,
  type LedgerClient,
  type OnLedgerStateRuntime,
  type PolicyEvent
} from "./onLedgerState.js";
import {
  createOnLedgerProtocolRuntime,
  type OnLedgerProtocolRuntime
} from "./onLedgerProtocolRuntime.js";

export type CreateOnLedgerSdkRuntimeInput = {
  xrplClient: LedgerClient;
  stateAccount: string;
  escrowVaultAccount: string;
  submitStateEvent: (event: PolicyEvent, label: string) => Promise<unknown>;
  submitRedemptionMarker?: RedeemTicketRuntime["submitRedemptionMarker"];
};

export type LedgerBackedSdkRuntime = {
  state: OnLedgerStateRuntime;
  protocol: OnLedgerProtocolRuntime;
};

export function createOnLedgerSdkRuntime(
  input: CreateOnLedgerSdkRuntimeInput
): LedgerBackedSdkRuntime {
  const state = createOnLedgerStateRuntime({
    xrplClient: input.xrplClient,
    stateAccount: input.stateAccount,
    escrowVaultAccount: input.escrowVaultAccount,
    submitStateEvent: input.submitStateEvent
  });

  return {
    state,
    protocol: createOnLedgerProtocolRuntime(state, {
      submitRedemptionMarker: input.submitRedemptionMarker
    })
  };
}
