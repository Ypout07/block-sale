import type { Client, Wallet } from "xrpl";
import {
  buildOnLedgerStateMemos,
  createOnLedgerStateRuntime,
  type PolicyEvent
} from "../../src/runtime/onLedgerState.ts";
import type { DevnetConfig } from "./primaryFlow.ts";
import { submitTx } from "./primaryFlow.ts";

export function createOnLedgerPolicyState(input: {
  client: Client;
  config?: DevnetConfig;
  vendorWallet: Wallet;
  escrowVaultWallet: Wallet;
}) {
  const { client, config, vendorWallet, escrowVaultWallet } = input;

  return createOnLedgerStateRuntime({
    xrplClient: client,
    stateAccount: vendorWallet.address,
    escrowVaultAccount: escrowVaultWallet.address,
    submitStateEvent: async (event: PolicyEvent, label: string) =>
      submitTx(
        client,
        vendorWallet,
        {
          TransactionType: "Payment",
          Account: vendorWallet.address,
          Destination: escrowVaultWallet.address,
          Amount: "1",
          Memos: buildOnLedgerStateMemos(event)
        },
        label,
        { config, log: false }
      )
  });
}
