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
4. Compile that single file first.
5. Replace the placeholder `vendor_pool` raw 20-byte account buffer with your real issuer AccountID bytes.
6. Fix Builder compile errors there first, then sync those source changes back into this repo.

## Why The Earlier Files Did Not Compile

Per the official Hooks docs, a Hook module may only define `hook()` and optionally `cbak()`. The earlier repo stubs were written as design scaffolds, not Builder-valid Hook modules.

Main blockers were:

- local include assumptions such as `utils.h`
- extra helper functions
- multi-file structure that the Builder was not using
- placeholder logic that was not yet written against `hookapi.h`

The current `bouncer.c` is now shaped as a Builder-first single-file starter.

## Test Workflow For Milestone One

1. Attach the compiled bouncer hook to the vendor pool account.
2. Make sure your test MPT exists on Devnet.
3. Attempt a transaction that would send the protected asset somewhere other than the vendor pool.
4. Confirm rollback.
5. Attempt the allowed path that returns the asset to the vendor pool.
6. Confirm success.

## Important Reality Check

The main unknown is not C syntax. It is attachment and observability:

- can the chosen hook placement actually see the transfer you care about?

Resolve that first. If the hook cannot observe the outbound movement, the rest of the logic does not matter.

## Next Repo Step

Once you have the first Builder compile working, copy the exact Builder-valid source back into:

- `contracts/src/bouncer.c`

At that point, we can tighten the payload fixtures and write the next stateful hook iteration for queued claims.
