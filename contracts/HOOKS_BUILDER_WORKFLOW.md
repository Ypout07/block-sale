# Hooks Builder Workflow

This is the practical setup for compiling and testing the contracts portion of the project.

## What You Actually Need

You do not need a local wasm toolchain for the current MVP.

You do need:

- an XRPL Devnet account for the vendor pool
- funded test accounts for at least:
  - vendor pool
  - ticket holder
  - unauthorized recipient
- the XRPL Hooks Builder web IDE
- the current hook source from this repo
- a real MPT issuance created on Devnet

## Critical Network Warning

Hooks do not execute on plain XRPL Devnet.

The current SDK/audit scripts default to:

- `wss://s.devnet.rippletest.net:51233`

That is useful for XRPL transaction plumbing, but it will never produce `HookExecutions`.

If you deploy a hook in Hooks Builder / Xahau and then run the audit against XRPL Devnet, the result will always look like this:

- normal transactions succeed
- `hookExecutions` is empty
- the unpaid-candidate scenario still passes

That means the hook was never in the execution path.

Before treating any contract audit as meaningful, make sure the audit runner and the deployed hook are on the same network.

If the product must stay on XRPL Devnet/Testnet, the live enforcement path should be the SDK policy gate instead of Hooks.

## Recommended Repo Additions

Keep these local files in the repo:

- `contracts/src/*.c`
- `contracts/src/utils.h`
- payload examples in `contracts/payloads/`
- a local deployment checklist
- a local log of deployed account addresses and hook hashes

Do not commit private seeds.

If you want persistence for deployment metadata, add a local file such as:

- `contracts/devnet.example.json`

and keep the real `contracts/devnet.json` ignored.

## Suggested Secrets File

Create a local file:

- `contracts/devnet.json`

Example shape:

```json
{
  "vendorPoolAddress": "r...",
  "holderAddress": "r...",
  "unauthorizedRecipientAddress": "r...",
  "mptIssuanceId": "0000...",
  "lastHookHash": "..."
}
```

Add it to `.gitignore` if you decide to store real deployment metadata locally.

## Compile Workflow

1. Open XRPL Hooks Builder.
2. Start with `contracts/src/bouncer.c`, not the whole contracts folder.
3. Use the Builder-provided `hookapi.h`.
4. Before deploying, run `npm run audit:primary-policy` from the repo root.
5. Open `contracts/build/primary-policy-config.json`.
6. Copy the current `hookParameters` values into the `SetHook` transaction in Builder:
   - `RLU`: 20-byte mock RLUSD issuer AccountID hex
   - `ISS`: 24-byte ticket `MPTokenIssuanceID` hex
7. Compile that single file and deploy it to the vendor account from the same artifact.
8. Fix Builder compile errors there first, then sync those source changes back into this repo.

## What The Generated Artifact Means

The file:

- `contracts/build/primary-policy-config.json`

is the authoritative contract-side runtime config for the current audit run.

It tells you:

- which vendor account the hook should live on
- which mock RLUSD issuer is valid for this run
- which MPT issuance is the protected ticket issuance
- the exact hex you must place in the hook install parameters

Important:

- the audit flow intentionally creates a fresh mock RLUSD issuer for a clean routing graph
- that means `RLU` changes between runs
- if `ISS` or `RLU` changes, redeploy the hook before treating the next audit as meaningful

## Why The Earlier Files Did Not Compile

Per the official Hooks docs, a Hook module may only define `hook()` and optionally `cbak()`. The earlier repo stubs were written as design scaffolds, not Builder-valid Hook modules.

Main blockers were:

- local include assumptions such as `utils.h`
- extra helper functions
- multi-file structure that the Builder was not using
- placeholder logic that was not yet written against `hookapi.h`

The current `bouncer.c` is now shaped as a Builder-first single-file starter.

## Test Workflow For Milestone One

1. If you are staying on XRPL Devnet/Testnet, run `npm run audit:primary-policy`.
2. Treat `contracts/build/primary-policy-audit.json` as the live demo gate.
3. If you later move to a Hooks-capable network, reuse the current `RLU` and `ISS` values from `contracts/build/primary-policy-config.json`.
4. Deploy `contracts/src/bouncer.c` in Builder using those install parameters.
5. Re-run the audit on that same Hooks-capable network.
6. Confirm the unpaid-buyer release is blocked and the paid scenarios remain allowed.

The audit report is written to:

- `contracts/build/primary-policy-audit.json`

That file is the current source of truth for whether the hook is actually enforcing the purchase rule.

## Important Reality Check

The main unknown is no longer C syntax. It is deployment freshness and observability:

- is the hook attached to the correct vendor account?
- is the deployed hook using the current `RLU` and `ISS` values from the artifact?
- do the audited transactions show `HookExecutions` once the hook is live?

Resolve that first. If the hook cannot observe the outbound movement, the rest of the logic does not matter.

## Next Repo Step

Once you have the first Builder compile working, copy the exact Builder-valid source back into:

- `contracts/src/bouncer.c`

At that point, we can tighten the payload fixtures and write the next stateful hook iteration for queued claims.
