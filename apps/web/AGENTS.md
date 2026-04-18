# Web App Context

This folder owns the user-facing frontend for the XRPL ticketing protocol.

Use this file as the local context document when working with an AI agent in `apps/web`.

## Source Planning Docs

This app should stay aligned with:

- [pitch_rationale.md](/C:/Users/natha/Downloads/block-sale/pitch_rationale.md)
- [product_ideas.md](/C:/Users/natha/Downloads/block-sale/product_ideas.md)

If code or UI ideas conflict with those planning docs, prefer the planning docs unless the team has explicitly revised the product direction.

## Product Role

The web app is not the protocol itself. It is a frontend for interacting with the protocol.

Its job is to expose the main user flows described in planning:

- buy tickets
- claim tickets
- return tickets
- join a waitlist
- manage venue/dashboard state
- support group buys with either one payer or split payment

The frontend should communicate protocol intent clearly:

- tickets are closed-loop assets
- peer-to-peer resale is intentionally blocked
- DID verification is part of eligibility
- returns go back to the venue pool, not to another buyer directly

## Architectural Boundaries

The frontend should own:

- App Router pages and layouts
- visual design system and interaction patterns
- wallet connection UX
- transaction-building UX
- SDK integration through hooks and store state
- status messaging for pending XRPL operations

The frontend should not own:

- direct protocol business rules that belong in hooks
- low-level XRPL transaction composition if that logic can live in the SDK
- DID verification rules beyond displaying status and invoking the SDK/oracle layer

## Expected User Flows

The current planning suggests these initial routes or equivalent flows:

- `/buy`: gift flow and split-buy flow
- `/claim`: claim / verification state
- `/dashboard`: venue inventory, returns, waitlist, treasury state

Additional likely screens:

- waitlist join / escrow confirmation
- ticket detail / return confirmation
- wallet onboarding / DID status

## Data and Integration Assumptions

Assume the frontend eventually consumes a protocol wrapper from `packages/ticket-sdk`.

The frontend should treat the SDK as the stable interface for:

- creating XRPL clients
- initiating buy / claim / return flows
- checking DID verification status
- later, joining waitlists and handling group split coordination

If the frontend needs behavior that is missing from the SDK, prefer adding it to the SDK rather than duplicating XRPL logic inside React components.

## Confirmed MVP Decisions

The team has made the following implementation decisions for the hackathon MVP:

- standardize on browser-native XRPL wallets
- Crossmark is the primary wallet integration target
- GemWallet is optional fallback only if needed later
- avoid mobile-wallet-first flows like Xaman for the demo because QR scanning and context switching slow down the pitch
- keep checkout and signing on a single screen where possible
- mock DID verification through a lightweight Next.js endpoint

For the MVP, the frontend should include a simple `/api/verify` route that accepts a phone number and returns a dummy cryptographic hex string. This is explicitly a demo mock, not a real verifier.

## UX Requirements From Planning

The planning docs imply several non-negotiable UX constraints:

- explain why tickets cannot be freely transferred
- distinguish gift flow from split flow
- show that all recipients must be predeclared and verified
- make refunds and restocking fee behavior explicit
- show failure states for incomplete multi-party purchase attempts
- surface waitlist escrow status clearly

## Current Code State

This app is only scaffolded.

Current placeholders:

- landing page with route cards
- basic pages for `buy`, `claim`, and `dashboard`
- `CheckoutForm` placeholder
- `useProtocol` stub
- `useWalletStore` scaffold

There is no production wallet integration, SDK wiring, or transaction lifecycle handling yet.

## Suggested Near-Term Work

1. Replace placeholder pages with actual flow-specific UI.
2. Define frontend types for ticket orders, recipients, DID status, and transaction states.
3. Connect `useProtocol` to the SDK.
4. Add wallet connection state and transaction status handling for Crossmark.
5. Build separate UI paths for:
   gift buy
   split buy
   return ticket
   waitlist join
6. Add the mocked `/api/verify` endpoint and wire it into the DID status flow.
7. Add route-level loading, error, and confirmation states.

## Guardrails For Agents

- Do not invent a resale marketplace UI. The protocol is explicitly closed-loop.
- Do not model tickets as freely transferable user-owned collectibles.
- Do not hide DID verification as an optional edge case. It is part of the system design.
- Keep protocol messaging consistent with the planning docs.
- If a flow depends on behavior not implemented in the SDK yet, leave a clear integration seam instead of hardcoding protocol logic into UI components.

## Open Questions To Resolve With The Team

- Which dashboard audience is first: venue operators, ticket holders, or both?
- Should waitlist and treasury/yield views be in the first build or treated as stretch features?
