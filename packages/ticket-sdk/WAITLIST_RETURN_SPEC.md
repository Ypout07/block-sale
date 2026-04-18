# Waitlist And Return Spec

This document defines the current SDK contract for waitlist escrows and return processing on XRPL Devnet.

## Waitlist

- Public SDK method: `Protocol.joinWaitlist(...)`
- A verified wallet locks a native-XRP escrow deposit into a dedicated escrow destination.
- The waitlist entry is persisted with status:
  - `planned`
  - `active`
  - `allocated`
  - `returned`
  - `expired`

The waitlist deposit is intentionally separate from the vendor account. In Devnet testing, a dedicated escrow vault is the cleanest way to hold the reservation deposit until a returned ticket is allocated.

## Returns

- Public SDK method: `Protocol.returnTicket(...)`
- A return requires:
  - a `claimed` ticket record
  - matching wallet ownership
  - a valid DID auth artifact

## Return Batch Contract

The return flow builds one `ALL_OR_NOTHING` batch plan with these inner operations:

1. holder returns the MPT to the vendor
2. vendor refunds the holder in issued USD
3. vendor finishes the next active waitlist escrow, if one exists

If a waitlist entry is allocated, the SDK creates a new pending claim record for that waitlist wallet so the normal `claimTicket(...)` flow can finish delivery.

## Current Devnet Note

The SDK currently enforces batch behavior through a batch plan plus runtime executor. This keeps the public contract stable on XRPL Devnet without claiming a live Hooks-based or amendment-dependent on-ledger enforcement path that Devnet may not provide consistently.
