# First Hook Milestone

This document defines the first real contract milestone for the hackathon.

The goal is not full ticketing yet. The goal is to prove one core product claim with the smallest possible hook surface:

- the hook prevents ticket movement anywhere except the vendor pool
- the hook establishes the state model needed for queued claims later

## Why This Is The Right First Step

This is the cleanest path to a testable product story:

1. It matches the architecture already chosen.
2. It proves the contract is actually enforcing the anti-scalping thesis.
3. It avoids overbuilding the full mint / return / waitlist machine too early.
4. It gives the frontend and SDK a stable contract to target.

## Milestone Scope

Implement only these behaviors first:

### Anti-transfer hook behavior

- observe the relevant transfer transaction type for MPT movement
- allow transfers where the destination is the vendor pool
- reject transfers where the destination is any other account
- return a clear rollback reason

### Queued-claims state design

- do not implement friend-claim acceptance yet
- do design HookState so multiple pending claims per recipient can be supported
- prefer queue-friendly keys now so later iterations do not require a state migration

## Deliberately Out Of Scope For This First Hook

- friend ticket sharing
- claim acceptance flow
- split-pay multi-sig
- waitlist reassignment
- restocking fee logic
- treasury / lending logic
- gate-scan freeze logic
- complex DID validation

## Proposed First-Milestone Transaction Contract

The first live hook test should be as simple as possible:

- submit a transaction that would move the ticket / MPT
- if `Destination == vendor_pool`, allow it
- otherwise rollback

This means the first builder implementation may not need any HookParameters at all.

## Proposed Queued-Claims HookState Contract

Since you want queued claims supported immediately, do not key only by recipient.

Use a queue-friendly model instead:

- key prefix: `claim:<recipient_account>:<claim_id>`
- value:
  - `ticket_id`
  - `recipient`
  - `proof`
  - `status`

That gives you multiple pending claims per account without redesign later.

For milestone one, this only needs to exist as a documented state contract. It does not need to be fully implemented before the transfer bouncer works.

## Manual Test Story

The first manual demo can be:

1. Deploy the bouncer hook to the vendor pool account.
2. Attempt a transfer from the protected path to a non-vendor destination.
3. Confirm the hook rolls back the transaction.
4. Attempt the allowed return path into the vendor pool.
5. Confirm that path succeeds.

## Product Feedback

This is the right reduction for the MVP. The judges do not need the entire lifecycle first. They need to see the one thing your protocol claims to make impossible actually fail on-ledger.

The strongest first demo is:

- unauthorized transfer fails
- return-to-pool path succeeds

That is clearer than starting with a partially built claim flow.

## Product-Driven Questions

1. What exact transaction type will carry the first real MPT movement that the bouncer must inspect?
2. Will the vendor pool be the issuer account itself, or a separate operational account that receives returned assets?
3. For queued claims, should `claim_id` be a simple incrementing sequence, or do you want it derived from transaction hash / ledger context from the start?
