# Advanced XRPL Feature Status

Status as of `2026-04-18` on XRPL Devnet.

## Working On-Chain

- `CredentialCreate` / `CredentialAccept`
- `PermissionedDomainSet` / `PermissionedDomainDelete`
- `EscrowCreate` / `EscrowFinish`
- issued-currency payments for the RLUSD-like mock flow
- `MPTokenAuthorize`
- MPT delivery and return-style payment planning

## Implemented In SDK

- `Protocol.setPermissionedDomain(...)`
- `Protocol.deletePermissionedDomain(...)`
- `Protocol.returnTicket(...)` builds a native `Batch` plan with:
  - `ticket_return`
  - `refund`
  - `waitlist_escrow_finish`

## Audits

- `npm run audit:primary-policy`
  - passes on XRPL Devnet
  - proves the supported purchase / claim / redeem / waitlist path
- `npm run audit:permissioned-domain`
  - passes on XRPL Devnet
  - proves permissioned domains are created and deleted on-ledger
- `npm run audit:native-batch`
  - currently fails on XRPL Devnet
  - this is expected until the connected Devnet enables native `Batch`

## Important Constraint

Native `Batch` is not currently viable on the connected XRPL Devnet. The audit shows:

- the node does not report `Batch` as an enabled known feature
- submitting the native `Batch` transaction returns `temDISABLED`

That means:

- native return execution cannot honestly rely on `Batch` on this network today
- the SDK can still build the exact `Batch` transaction contract now
- once Devnet enables `Batch`, the existing audit is the right place to prove the transition from planned to executable

## Not Implemented Yet

- Permissioned DEX trading flow
- Single Asset Vault flow
- Lending protocol integration

Permissioned Domains are the current on-ledger building block for those future flows, but the actual product integrations are still pending.
