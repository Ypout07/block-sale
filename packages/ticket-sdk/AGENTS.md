# Ticket SDK Context

This folder owns the middleware wrapper between the frontend and the XRPL protocol behavior.

Use this file as the local context document when working with an AI agent in `packages/ticket-sdk`.

## Source Planning Docs

This SDK should stay aligned with:

- [pitch_rationale.md](/C:/Users/natha/Downloads/block-sale/pitch_rationale.md)
- [product_ideas.md](/C:/Users/natha/Downloads/block-sale/product_ideas.md)

The product planning defines the SDK's purpose: abstract complex XRPL interactions into a cleaner developer-facing interface.

## Product Role

The SDK is the adapter layer that turns protocol actions into a usable API for the web app and any future clients.

The planning explicitly positions this as a developer-facing package similar to:

- `Protocol.buyGiftTickets(...)`
- `Protocol.initiateSplitBuy(...)`
- `Protocol.joinWaitlist(...)`
- `Protocol.returnTicket(...)`

The SDK should hide or simplify:

- XRPL connection management
- transaction construction
- hook invocation details
- DID verification checks
- multi-party coordination logic where feasible

## Confirmed MVP Decisions

The team has made the following implementation decisions for the hackathon MVP:

- the SDK is strictly browser-first
- keep execution client-side where possible
- use `xrpl.js` directly in the browser
- avoid adding server-heavy orchestration back into the MVP
- DID verification remains intentionally mocked for the demo
- Crossmark is the primary wallet target for frontend signing flows

This means the SDK should optimize for frontend integration and transaction payload construction, not for server execution or backend job orchestration.

## Architectural Boundaries

The SDK should own:

- XRPL client lifecycle helpers
- protocol method entry points
- typed inputs/outputs for app consumption
- orchestration of oracle / DID checks
- serialization of payloads used to interact with hook-backed flows

The SDK should not own:

- frontend state management or UI behavior
- Wasm Hook business rules themselves
- venue dashboard rendering

## Protocol Assumptions From Planning

The planning docs define several core constraints the SDK must reflect:

- tickets are not freely transferable
- the venue pool is the central counterparty for buy and return flows
- recipient wallets must be declared upfront for group purchases
- DID-backed humanness verification gates recipients
- split buys rely on multi-signing and atomic execution
- returns and waitlist reassignment should behave atomically
- minting and transfer behavior should be real on XRPL Devnet, not mocked

These are not optional features. The SDK interface should make these rules visible in its naming and method contracts.

## Recommended Public Surface

The current scaffold includes:

- `createXrplClient`
- `buyGroupTicket`
- `claimTicket`
- `returnTicket`
- `verifyDid`
- `Protocol` class

Based on planning, the likely target public API should expand toward:

- `buyGiftTickets`
- `initiateSplitBuy`
- `claimTicket`
- `returnTicket`
- `joinWaitlist`
- `getDidStatus`
- `buildHookInvocationPayload`

The SDK should return typed, explicit results rather than raw ledger responses wherever that improves app integration.

## Current Code State

This package is only scaffolded.

Current placeholders:

- `xrplClient.ts` creates a basic `xrpl` client
- method files return stub objects
- DID verification is a mock
- `Protocol` is a thin wrapper with minimal behavior

There is no real transaction-building logic, no hook parameter encoding, and no waitlist or multi-sig flow yet.

## Suggested Near-Term Work

1. Define shared TypeScript types for protocol actions and ledger responses.
2. Keep the package browser-safe and avoid APIs that assume a Node-only runtime.
3. Implement real buy / claim / return transaction builders.
4. Add an explicit split-buy method instead of overloading the current buy method.
5. Add waitlist and escrow-oriented methods.
6. Integrate with the frontend's mocked `/api/verify` flow or accept its returned verification artifact as an input.
7. Design payload builders around real HookParameters for ephemeral instructions such as predeclared recipient addresses.
8. Add tests around transaction payload generation and method contracts.

## Guardrails For Agents

- Do not expose APIs that imply free user-to-user transfers.
- Do not collapse gift flow and split flow into one vague method if they require different signing behavior.
- Avoid pushing XRPL-specific complexity into the web layer when the SDK can encapsulate it cleanly.
- Keep the SDK opinionated around the protocol's closed-loop model.
- Prefer explicit types and method names over generic helper utilities with unclear behavior.

## Open Questions To Resolve With The Team

- How much signing logic belongs in the SDK versus the connected wallet?
- What exact XRPL transaction types and hook invocation formats are being targeted for the hackathon demo?
- Should the SDK include a Crossmark-specific adapter, or should wallet glue remain in the web app?
