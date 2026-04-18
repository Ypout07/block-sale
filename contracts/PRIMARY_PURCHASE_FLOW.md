# Primary Purchase Flow

This is the first cohesive product step after the bouncer smoke test.

The goal is not full protocol completeness yet. The goal is to stand up the real plumbing for a primary purchase using the actual XRPL primitives the project is built around.

## What This First Step Should Prove

1. the vendor account can issue a real MPT
2. the buyer can hold a stablecoin balance used as a mock RLUSD balance on Devnet
3. the buyer can authorize receipt of the ticket MPT
4. the buyer can pay the vendor in the stablecoin
5. the vendor can deliver the ticket MPT to the buyer

That is the minimum viable "primary purchase and issuance" story.

## Product Reality Check

For this first step:

- RLUSD is functionally mocked as a Devnet-issued USD token from a separate issuer account
- DID verification is functionally mocked upstream
- escrow and DeFi yield are intentionally out of the transaction path for this first purchase flow

That is acceptable because the first milestone is about proving the transaction plumbing and the policy enforcement boundary.

## Asset Roles

Keep these roles separate:

- stablecoin issuer: supplies the mock RLUSD-like asset on Devnet
- vendor / issuer account: receives payment and releases the ticket MPT
- buyer: receives stablecoin funding, pays vendor, authorizes and receives ticket

The vendor should not need to be the stablecoin issuer. The enforcement point belongs on the vendor side because the vendor decides when a valid purchase is allowed to result in ticket delivery.

## Real XRPL Transaction Sequence

The intended on-ledger sequence for the first milestone is:

1. `MPTokenIssuanceCreate`
   Creates the venue's ticket issuance.

2. `TrustSet`
   Buyer creates a trust line for the mock RLUSD issuer.

3. `Payment`
   Issuer funds the buyer with mock RLUSD on Devnet.

4. `MPTokenAuthorize`
   Buyer authorizes receipt of the venue's MPT issuance.

5. `Payment`
   Buyer pays the vendor in mock RLUSD.

6. `Payment`
   Vendor sends the MPT to the buyer using `MPTAmount`.

## Why This Order

This order mirrors the actual XRPL prerequisites:

- non-XRP balances need trust setup before funding
- MPT receipt requires `MPTokenAuthorize`
- MPT transfer then occurs as a payment using `mpt_issuance_id`

## Policy Role In This Milestone

On XRPL Devnet/Testnet, the strict rule has to live in the product policy layer:

- record approval state when the vendor receives payment in the configured RLUSD-like issuer
- allow vendor MPT release only when approval state exists for that destination
- consume the approval after the ticket is released

This removes the old "declared intent" dependency and moves the rule boundary to:

- money in first
- ticket out second

## Audit Loop

The XRPL-side policy loop is now:

1. run `npm run audit:primary-policy`
2. verify that payment proof is created from a real XRPL payment
3. verify that unpaid buyers are rejected before the vendor release transaction is submitted
4. verify that paid buyers receive exactly one release
5. verify that consumed approval cannot be reused

The audit report lives at:

- `contracts/build/primary-policy-audit.json`

The policy state lives at:

- `contracts/build/primary-policy-state.json`

If the unpaid candidate scenario still succeeds, the policy gate is not being used as the vendor release path.

## Future Layers

Once the primary purchase path works end-to-end, then layer in:

- DID-gated eligibility checks
- return-to-vendor-only enforcement
- queued claims in HookState
- waitlist escrow
- treasury / DeFi routing

## Sources

- `MPTokenIssuanceCreate`: https://js.xrpl.org/interfaces/MPTokenIssuanceCreate.html
- `Payment` with `MPTAmount`: https://js.xrpl.org/interfaces/Payment.html
- MPT payment examples: https://xrpl.org/payment.html?source=post_page---------------------------
- `MPTokenAuthorize`: https://xrpl.org/docs/references/protocol/transactions/types/mptokenauthorize
- `EscrowCreate`: https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate
- DID ledger entry / DIDSet context: https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/did
