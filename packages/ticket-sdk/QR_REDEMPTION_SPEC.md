# QR Redemption Spec

This document defines the current SDK contract for ticket redemption QR codes.

## Product Flow

1. A wallet has a ticket in `claimed` state.
2. The client calls `Protocol.generateTicketQr(...)`.
3. The SDK returns a JSON payload string to embed in a QR code.
4. The venue scanner reads that QR text and passes it to `Protocol.redeemTicket(...)`.
5. The SDK validates the QR payload, validates DID, checks the ticket record, and marks the ticket `redeemed`.
6. Any second scan of the same claimed ticket must fail.

## Ticket Lifecycle

The SDK-managed lifecycle now uses these states:

- `pending_authorization`
- `claimed`
- `redeemed`

Redemption is only valid from `claimed`.

## QR Payload Schema

The QR code text is a JSON string with this schema:

```json
{
  "schemaVersion": 1,
  "purpose": "ticket-redemption",
  "ticketId": "paymentHash:recipientWallet:ticketIndex",
  "wallet": "r...",
  "venueId": "r...",
  "issuanceId": "0013...",
  "didProvider": "mock-phone-proof",
  "didToken": "wallet-or-wallet-bound-proof",
  "nonce": "hex-string",
  "issuedAt": "2026-04-18T12:00:00.000Z",
  "expiresAt": "2026-04-18T12:01:30.000Z",
  "qrHash": "sha256-hex"
}
```

## Hash Contract

`qrHash` is SHA-256 over this pipe-delimited string:

```text
schemaVersion|purpose|ticketId|wallet|venueId|issuanceId|didProvider|didToken|nonce|issuedAt|expiresAt
```

The scanner must recompute this hash and reject the QR if it does not match.

## Validation Rules

`redeemTicket(...)` must reject when:

- `ticketId` does not match the requested ticket
- `wallet` does not match the redeeming wallet
- `venueId` does not match the scanning venue
- `qrHash` does not match the payload contents
- `expiresAt` is in the past
- the ticket record is not in `claimed`
- DID verification fails
- the ticket has already been redeemed

## Current SDK Surface

- `Protocol.generateTicketQr(...)`
- `Protocol.redeemTicket(...)`

The scanner integration should treat this document as the source of truth for the payload shape and validation semantics.
