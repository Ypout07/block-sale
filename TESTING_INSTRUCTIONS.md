# Testing Instructions

This repo currently supports two testing tracks:

- `XRPL Devnet`
- `Local Experimental XRPL Server`

Use `XRPL Devnet` for the stable MVP path.

Use the local experimental server when you want to test amendments or feature combinations that public Devnet does not currently support, such as native `Batch` or certain permissioned-domain + MPT combinations.

## Prerequisites

- install dependencies
- have access to the repo root
- for local experimental testing, have the XRPL server running and exposing a websocket URL

## Main Commands

Run these from the repo root.

### `npm run build:sdk`

What it does:
- type-checks and builds the SDK

What it proves:
- the SDK compiles cleanly
- exported interfaces and scripts are internally consistent

What it does not prove:
- blockchain behavior

### `npm run audit:credential-auth`

What it does:
- runs the credential audit against the connected XRPL network

What it tests:
- real `CredentialCreate`
- real `CredentialAccept`
- on-ledger credential verification
- negative-case auth rejection

What it proves:
- wallet auth is using real XRPL credentials, not a fake local-only flag

### `npm run audit:primary-policy`

What it does:
- runs the main MVP lifecycle audit

What it tests:
- DID / credential gating for purchase
- waitlist join with escrow
- solo purchase
- group purchase
- pending recipient flow
- claim flow
- QR generation
- QR redemption
- negative cases:
  - missing auth
  - duplicate claim
  - QR replay
  - expired QR
  - wrong venue

What it proves:
- the current supported product path works end-to-end

Important note:
- this is the best command for demonstrating the current MVP

### `npm run audit:permissioned-domain`

What it does:
- runs the permissioned domain audit

What it tests:
- real `PermissionedDomainSet`
- real `PermissionedDomainDelete`
- on-ledger existence of the permissioned domain object
- auth requirement for domain management

What it proves:
- permissioned domains are actually working on the connected network

### `npm run audit:native-batch`

What it does:
- runs the native `Batch` audit

What it tests:
- whether the connected network supports native XRPL `Batch`
- whether a real all-or-nothing batch can execute on-ledger
- whether an invalid batch is rejected cleanly

What it proves:
- whether native `Batch` is actually available on the network you are testing

Important note:
- on public XRPL Devnet, this currently fails meaningfully because `Batch` is disabled there
- that failure is useful; it shows a real network limitation rather than a fake local shortcut

## Stable MVP Testing On XRPL Devnet

Use the default commands with no extra configuration:

```bash
npm run build:sdk
npm run audit:credential-auth
npm run audit:primary-policy
npm run audit:permissioned-domain
```

Expected result:
- all of the above should pass

Optional:

```bash
npm run audit:native-batch
```

Expected result:
- likely fails on Devnet
- that is currently expected

## Testing Against A Local Experimental XRPL Server

The SDK can target a different XRPL websocket by setting `XRPL_WS_URL`.

### PowerShell

Set the websocket for the current shell:

```powershell
$env:XRPL_WS_URL="ws://127.0.0.1:6006"
```

Then run:

```powershell
npm run audit:credential-auth
npm run audit:permissioned-domain
npm run audit:native-batch
npm run audit:primary-policy
```

Or run one command inline:

```powershell
$env:XRPL_WS_URL="ws://127.0.0.1:6006"; npm run audit:native-batch
```

### Alternative Config File Option

You can also set the network in `contracts/devnet.json`:

```json
{
  "networkWsUrl": "ws://127.0.0.1:6006"
}
```

The runtime checks for network URL in this order:

1. `XRPL_WS_URL`
2. `contracts/devnet.json -> networkWsUrl`
3. public XRPL Devnet fallback

## Recommended Order For Local Experimental Testing

Run in this order:

1. `npm run audit:credential-auth`
2. `npm run audit:permissioned-domain`
3. `npm run audit:native-batch`
4. `npm run audit:primary-policy`

Why:
- first prove auth
- then prove permissioned domains
- then prove native batch support
- then run the full product flow

## How To Explain The Tests

If you are discussing this with a judge or blockchain engineer, use this framing:

- `audit:primary-policy` proves the stable MVP path on XRPL
- `audit:credential-auth` proves auth is real and on-ledger
- `audit:permissioned-domain` proves permissioned domains are real and on-ledger
- `audit:native-batch` proves whether the target network actually supports native batch execution

That lets you distinguish clearly between:

- product logic that is already working
- advanced features that depend on network amendment support

## Current Truthful Status

On public XRPL Devnet today:

- credentials work
- permissioned domains work
- MPT auth and transfers work
- escrow works
- buy / claim / redeem flow works
- native `Batch` is not currently available

That means the stable MVP path is functional now, while native `Batch` and other experimental combinations should be tested against a local experimental XRPL instance.
