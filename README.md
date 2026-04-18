# XRPL Ticketing Protocol

This repository is now scaffolded as a small monorepo for the closed-loop XRPL ticketing protocol described in [pitch_rationale.md](/C:/Users/natha/Downloads/block-sale/pitch_rationale.md) and [product_ideas.md](/C:/Users/natha/Downloads/block-sale/product_ideas.md).

## Architecture

- `apps/web`: Next.js frontend for purchase, claim, return, waitlist, and venue dashboard flows.
- `packages/ticket-sdk`: TypeScript SDK that wraps XRPL connectivity, DID/oracle checks, and protocol methods.
- `contracts`: XRPL Wasm Hook source, test payloads, and deployment script placeholders.

## Workspace Layout

```text
xrpl-ticketing-protocol/
├── apps/
│   └── web/
├── packages/
│   └── ticket-sdk/
├── contracts/
├── backend/
├── pitch_rationale.md
└── product_ideas.md
```

The existing `backend/requirements.txt` has been left untouched as legacy exploratory work. The new scaffold is centered on the monorepo layout above.

## Next Build Steps

1. Install dependencies from the root with your package manager of choice.
2. Implement the SDK methods against real `xrpl` client calls.
3. Replace the contract placeholders with actual Wasm Hook logic and deployment tooling.
4. Wire the frontend flows to the SDK once wallet and DID assumptions are finalized.
