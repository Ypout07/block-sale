# DID Auth Spec

This document defines the current SDK contract for wallet authentication.

## Product Model

- Identity is modeled as `human-to-wallet`.
- One auth artifact proves one verified human controls one XRPL wallet.
- The artifact is required for all execution steps:
  - `buyGiftTickets(...)`
  - `claimTicket(...)`
  - `generateTicketQr(...)`
  - `redeemTicket(...)`

Planning-only SDK calls may omit auth because they do not move assets.

## Current SDK Surface

- `Protocol.authenticateWallet(...)`
- `Protocol.verifyWallet(wallet, didAuth?)`

The current implementation is intentionally mocked, but the artifact contract is stable and the provider is injectable.

## Artifact Schema

```json
{
  "schemaVersion": 1,
  "subjectType": "human-to-wallet",
  "wallet": "r...",
  "provider": "mock-phone-proof",
  "subjectIdHash": "sha256-hex",
  "verifiedAt": "2026-04-18T13:00:00.000Z",
  "expiresAt": "2026-04-18T13:10:00.000Z",
  "authToken": "sha256-hex"
}
```

## Validation Rules

Verification must reject when:

- no artifact is provided
- wallet format is invalid
- artifact wallet does not match the requested wallet
- schema version or subject type is invalid
- the artifact token does not match its contents
- the artifact has expired

## Integration Model

The provider is injected through the SDK runtime/provider interface:

- `DidAuthProvider.authenticateWallet(...)`
- `DidAuthProvider.verifyWallet(...)`

The mock provider is the default implementation today. A real verifier/oracle can replace it later without changing the public SDK method shapes.
