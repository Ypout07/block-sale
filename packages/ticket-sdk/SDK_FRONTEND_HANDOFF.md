# SDK Frontend Handoff

This document is for the frontend integration only.

The frontend should treat the SDK as the contract boundary and should not need to know most protocol internals.

## What The Frontend Should Care About

- which public SDK methods exist
- what inputs they need
- what outputs they return
- what user states must be rendered
- which features are available now vs planned later

## Public SDK Methods

Instantiate once:

```ts
import { Protocol, createCredentialAuthProvider } from "@xrpl-ticketing/ticket-sdk";

const didProvider = createCredentialAuthProvider({
  xrplClient,
  defaultIssuerAddress: RLUSD_ISSUER
});

const protocol = new Protocol(
  VENDOR_ADDRESS,
  RLUSD_ISSUER,
  MPT_ISSUANCE_ID,
  didProvider
);
```

### `authenticateWallet(input)`

Purpose:
- creates the auth artifact used by the rest of the flow

Frontend expectation:
- call after wallet connection / verification
- store the returned artifact in client state for later SDK calls

Returns:
- `WalletDidAuth`

### `verifyWallet(wallet, didAuth?)`

Purpose:
- validates a wallet auth artifact

Returns:
- `verified`
- `provider`
- optional `reason`

### `buyGiftTickets(input)`

Purpose:
- single purchase endpoint for solo or group purchase

Input:
- `venueId`
- `payerWallet`
- `recipients: string[]`
- `amountRlusd: number`
- `payerDidAuth?`
- `recipientDidAuth?: Record<string, WalletDidAuth>`

Returns:
- `purchaseMode`
- `groupSize`
- `paymentTx`
- `paymentStatus`
- `deliveredRecipients`
- `pendingRecipients`
- `failedRecipients`

Frontend expectation:
- solo purchase is just one recipient
- group purchase uses the same method
- render delivered vs pending recipients separately

### `claimTicket(input)`

Purpose:
- claims a pending ticket for a recipient

Input:
- `venueId`
- `wallet`
- `ticketId`
- `didAuth?`

Returns:
- `claimStatus`
- `authorizeTx`
- optional `releaseTx`

Frontend expectation:
- use this for pending recipients after they verify and authorize

### `generateTicketQr(input)`

Purpose:
- generates the QR payload for a claimed ticket

Input:
- `ticketId`
- `wallet`
- `didAuth`

Returns:
- `payload`
- `qrCodeText`

Frontend expectation:
- render `qrCodeText` as the displayed QR

### `redeemTicket(input)`

Purpose:
- scanner-side redemption validation

Input:
- `ticketId`
- `wallet`
- `venueId`
- `qrCodeText`
- `didAuth?`

Returns:
- `redemptionStatus`
- `redemptionHash`

Frontend expectation:
- this is the scanner flow, not the buyer-ticket-display flow

### `joinWaitlist(input)`

Purpose:
- creates a waitlist reservation

Input:
- `venueId`
- `wallet`
- `depositDrops`
- `didAuth`

Returns:
- `waitlistId`
- `escrowStatus`
- `escrowTx`
- `waitlistEntry`

### `returnTicket(input)`

Purpose:
- builds the return contract for a ticket

Input:
- `venueId`
- `wallet`
- `ticketId`
- `didAuth?`

Returns:
- `returnStatus`
- `batchPlan`
- optional `allocatedWaitlistEntry`

Frontend expectation:
- use this as the return entrypoint
- do not assume native batch execution status from the frontend alone

### `setPermissionedDomain(input)`

Purpose:
- creates or updates a permissioned domain

### `deletePermissionedDomain(input)`

Purpose:
- deletes a permissioned domain

These are admin / advanced flows, not normal buyer flows.

## User States The Frontend Must Render

For purchase results:
- `delivered`
- `pending_authorization`
- `pending_did_verification`
- `release_failed`

For ticket lifecycle:
- `claimed`
- `redeemed`
- `returned`

For waitlist:
- `planned`
- `active`
- `allocated`

## What The Frontend Does Not Need To Care About

- XRPL credential transaction details
- exact escrow transaction structure
- native Batch internals
- permissioned domain ledger object format
- internal policy storage layout

Those are SDK / protocol concerns.

## What Still Affects The Frontend

Even though implementation details are mostly abstracted, these product facts still matter to UI:

- a group purchase can return both `deliveredRecipients` and `pendingRecipients`
- a recipient may need to claim later instead of receiving instantly
- QR generation only makes sense for claimed tickets
- redemption is one-time
- return flow exists, but native Batch is not currently available on XRPL Devnet

Those are not low-level protocol details. They are user-facing state transitions.

## Current Safe Frontend Scope

Frontend can safely build now for:

- wallet auth
- buy flow
- pending ticket claim flow
- ticket QR display
- venue scan / redeem flow
- waitlist join
- return entry flow

Planned later:

- permissioned DEX UI
- vault / lending UI
- experimental-network-only features that are not active on public Devnet
