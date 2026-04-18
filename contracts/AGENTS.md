# Contracts Context

This folder owns the XRPL Wasm Hook layer for protocol enforcement.

Use this file as the local context document when working with an AI agent in `contracts`.

## Source Planning Docs

This folder should stay aligned with:

- [pitch_rationale.md](/C:/Users/natha/Downloads/block-sale/pitch_rationale.md)
- [product_ideas.md](/C:/Users/natha/Downloads/block-sale/product_ideas.md)

The planning docs are especially important here because the core product claim depends on ledger-enforced behavior, not just app logic.

## Product Role

The contracts folder is where the protocol's hard guarantees should live.

Per planning, the hook layer is responsible for enforcing the closed-loop ticketing model:

- reject unauthorized peer-to-peer ticket transfers
- allow return-to-venue behavior
- validate purchase / claim parameters
- manage hook state for ticket lifecycle operations
- support claim and reassignment flows tied to venue-controlled logic

If the frontend or SDK says something is forbidden, the hook layer should be the reason it is actually forbidden.

## Core Protocol Rules From Planning

The planning docs define the protocol thesis in concrete terms:

- tickets can only originate from the venue pool
- tickets can only return to the venue pool
- resale to arbitrary wallets should fail
- DID-verified recipients gate access to ticket issuance
- returns may trigger waitlist reassignment and refunds
- split payment and reassignment flows must be atomic wherever possible
- tickets may eventually be frozen or marked used at the gate

This means the contract layer is the source of truth for protocol enforcement.

## Folder Responsibilities

- `src/bouncer.c`: unauthorized transfer rejection and venue-return allowance
- `src/pay_and_claim.c`: payment, mint, claim, and hook state transitions
- `src/utils.h`: shared parsing / helper utilities
- `payloads/`: local test or demo transaction payloads
- `scripts/`: deployment helpers for devnet or demo networks
- `build/`: compiled Wasm artifacts

## Confirmed MVP Decisions

The team has made the following implementation decisions for the hackathon MVP:

- use the real XRPL Hooks Builder web IDE for authoring and compilation
- avoid spending time on a local WebAssembly compiler toolchain for now
- prioritize real hook behavior over infrastructure polish
- DID verification is mocked upstream, so the contract layer can assume it receives a demo verification artifact or parameter rather than proving real-world identity
- minting and hook behavior are 100% real on XRPL Devnet
- use real `MPTokenIssuanceCreate`, real hook interception, and real `emit()`-driven token transfer behavior
- split ephemeral transaction instructions from persistent HookState data

This means the contract effort should focus on correct hook logic, parameter parsing, HookState behavior, and rejection paths that demonstrate anti-scalping enforcement.

## State Model Decision

The team has explicitly defined the state model:

- `HookParameters` are for ephemeral per-transaction instructions
- `HookState` is for persistent on-ledger memory

Expected pattern:

- the frontend sends recipient addresses and other one-shot purchase instructions through `HookParameters`
- the hook reads those parameters during the purchase transaction
- the hook immediately persists claimable assignment data into `HookState`
- later, a claimant submits a separate transaction
- the hook reads the stored assignment from `HookState`
- the hook issues the real token transfer
- the hook deletes consumed state once the claim is complete

Agents should preserve this distinction instead of storing one-shot instructions permanently or overloading parameters as long-term state.

## Current Code State

This folder is only scaffolded.

Current placeholders:

- `bouncer.c` has comments for rollback-oriented enforcement
- `pay_and_claim.c` has comments for payment / claim flow logic
- `utils.h` contains only a minimal placeholder type
- payload JSON files are mock examples
- deploy script is a stub

No real hook implementation or build toolchain has been added yet.

## Suggested Near-Term Work

1. Define the minimal hook behaviors required for the demo.
2. Specify exact hook parameter formats and expected payload schemas for buy and claim flows.
3. Implement the transfer bouncer first, since closed-loop enforcement is central to the pitch.
4. Implement purchase / claim state handling second, using `state_set()` for claimable assignments.
5. Mirror the source in the XRPL Hooks Builder workflow and keep local files in sync with the deployed demo version.
6. Add local fixtures or reproducible payloads for each happy-path and rejection-path scenario.
7. Add deployment notes or scripts that document the Hooks Builder to Devnet path.

## Guardrails For Agents

- Do not treat the contract layer as optional validation. It is the product's enforcement layer.
- Do not allow user-to-user ticket transfer behavior unless the team deliberately changes the protocol design.
- Avoid encoding too much app-specific presentation logic into hook parameters.
- Keep parameter parsing, validation, and state mutation explicit and testable.
- If a flow cannot be enforced safely at the hook level, call that out clearly rather than assuming the frontend will handle it.

## High-Value Test Scenarios

Agents working here should think in terms of protocol invariants and rejection cases, including:

- unauthorized wallet attempts peer-to-peer transfer
- verified wallet buys for declared recipients
- hook reads recipient addresses from `HookParameters` and persists claimable state correctly
- undeclared or unverified recipient is rejected
- claimant triggers real token issuance/transfer from previously stored `HookState`
- consumed claim state is deleted after successful claim
- holder returns ticket to venue pool
- waitlist reassignment succeeds atomically
- waitlist reassignment fails safely and original holder keeps the ticket
- used or frozen ticket cannot be reused

## Open Questions To Resolve With The Team

- What data needs to live in HookState versus being inferred from transaction parameters?
- Which invariants are absolutely required for the first demo milestone, and which are stretch goals?
