# The Closed-Loop Ticketing Protocol: Architecture & Product Spec

## 1. Motivation
The traditional event ticketing industry suffers from the "Oracle Problem." Centralized platforms cannot control the physical exchange of cash in secondary markets, leading to rampant scalping, predatory markups, and artificial scarcity driven by bot networks. Furthermore, group ticketing is historically broken—forcing one person to front hundreds of dollars or relying on Venmo IOUs, while still leaving the tickets vulnerable to secondary scalping.

## 2. The Proposed Solution
A **Closed-Loop Automated Market Maker (AMM) Ticketing Protocol** built natively on the XRP Ledger (XRPL). 

This protocol completely eliminates the peer-to-peer secondary market. Tickets can only be minted by the Venue Pool and returned to the Venue Pool. By forcing all liquidity and transfers through an immutable ledger-based protocol (governed by Wasm Hooks), scalping becomes mathematically and economically impossible.

## 3. The Group Buy & Gifting Engine (The DID Multi-Mint)
To facilitate buying for friends without opening P2P transfer loopholes, the protocol requires upfront declaration and identity verification.

**Pre-requisite:** Every participant (the buyer and all friends) must have an XRPL wallet with a verified Decentralized Identifier (DID). The DID proves "humanness" (e.g., via a Zero-Knowledge Proof of a unique phone number) without doxing personal data.

When purchasing, the buyer declares the destination wallets upfront. The protocol offers two distinct flows:

### Flow A: The Gift (Single Payer, Multi-Recipient)
* **The Intent:** Alice wants to buy 3 tickets for herself, Bob, and Charlie, and she is paying for all of them.
* **The Execution:** Alice initiates a transaction for 150 RLUSD, specifying the destination DID wallets (Alice, Bob, Charlie).
* **The Protocol Logic:** The Hook on the Venue Pool intercepts the transaction. It verifies all three DIDs. Upon success, it mints 1 MPT directly to Alice, 1 to Bob, and 1 to Charlie.
* **State Rules:** Because the MPTs are instantly distributed, Alice *cannot* return Bob's or Charlie's tickets. If Bob cannot attend, Bob must initiate the return from his own wallet back to the Venue Pool.

### Flow B: The Split (Multi-Payer, Multi-Recipient)
* **The Intent:** Alice, Bob, and Charlie want to go together, but each wants to pay their own 50 RLUSD share.
* **The Execution:** Alice configures the group order in the protocol app. The protocol constructs a **Multi-Signature (Multi-Sig)** transaction.
* **The Protocol Logic:** The transaction requires cryptographic signatures from Alice, Bob, and Charlie, authorizing 50 RLUSD from each of their wallets. Once all three sign, the transaction is submitted to the ledger.
* **State Rules:** The Hook verifies the total 150 RLUSD and the three DIDs. It then atomically pulls the funds from each wallet and mints the MPTs to their respective wallets. No one fronts the money, and no IOUs are needed.

## 4. Product Flow: Waitlists & Returns
**Scenario:** A 5,000-seat stadium concert sells out.

1.  **The Waitlist:** Dave wants to go. He joins the on-chain waitlist by locking 50 RLUSD into a Smart Escrow.
2.  **The Return (No Reselling):** Two weeks before the show, Bob (from the group above) realizes he cannot attend. He cannot sell the ticket on StubHub. He clicks "Return" in the protocol app.
3.  **Atomic Resolution:** The protocol instantly takes Bob's MPT, refunds him 49 RLUSD (50 RLUSD minus a 2% restocking fee), pulls Dave's 50 RLUSD from Escrow, and sends Dave the MPT. 

## 5. Technical Implementation & XRPL Primitives

To achieve this rigorous, closed-loop architecture, the system combines several XRPL native features.

### Multi-Purpose Tokens (MPTs)
Tickets are issued as MPTs rather than standard NFTs (XLS-20). MPTs are optimized for Real-World Assets, allowing the venue to issue 5,000 "General Admission" tickets under a single asset class. MPTs support native `Freeze` flags, allowing the protocol to permanently lock the token state to "Used" once scanned at the physical gate.

### Stablecoin Flows (RLUSD)
All transactions, refunds, and escrow locks are denominated in RLUSD. This protects both the fans and the venue from cryptocurrency price volatility.

### Wasm Hooks (The Bouncer & Mint Engine)
A custom WebAssembly (Wasm) Hook is attached to the Venue Pool. This acts as the immutable law of the protocol:
* It rejects any MPT transfer to a wallet other than the Venue Pool (blocking P2P scalping).
* It validates the DIDs of all recipients in a group buy before executing the mint.

### XRPL Multi-Signing
Used specifically for the "Split" payment flow. It allows the protocol to bundle authorization from multiple wallets into a single atomic ledger execution, completely eliminating counterparty risk between friends.

### Smart Escrow & TokenEscrow
When a user joins the waitlist, their RLUSD is locked in a native ledger Escrow. This ensures the protocol has guaranteed liquidity to buy back returning tickets instantly.

### Batch Transactions (Atomic Settlement)
Batch transactions ensure that complex, multi-step operations happen simultaneously as an "all-or-nothing" ledger update. If any single step in the batch fails, the entire transaction is reverted, preventing broken states or lost funds. We leverage Batch Transactions in two critical flows:

**1. The Return & Waitlist Loop**
When Bob returns his ticket, the Hook triggers a Batch Transaction that executes the following simultaneously:
* **Ticket & Fee Processing:** The MPT is pulled from Bob back to the Venue Pool, and the protocol calculates a 2% restocking fee (1 RLUSD).
* **Refund:** 49 RLUSD is pushed to Bob's wallet.
* **Waitlist Execution:** Dave's 50 RLUSD is pulled from his Smart Escrow.
* **Ticket Reassignment:** The MPT is transferred to Dave.
*(If Dave's escrow expired or failed, the batch fails safely, Bob keeps his ticket to try again later, and the ledger remains perfectly consistent.)*

**2. The Group "Split" Flow (Friends & Family)**
When friends buy tickets together paying separately, the Multi-Sig authorizes a Batch Transaction that simultaneously:
* Pulls 50 RLUSD from Alice, 50 RLUSD from Bob, and 50 RLUSD from Charlie.
* Mints and distributes 1 MPT to Alice, 1 MPT to Bob, and 1 MPT to Charlie.
*(This guarantees atomic group ticketing. If Charlie's wallet doesn't have the required 50 RLUSD, the entire batch fails. Alice and Bob aren't left holding tickets they didn't want to buy alone, and the venue doesn't have partial inventory locked up.)*

### Single Asset Vault & Lending Protocol (DeFi Integration)
The Venue Pool holds millions in RLUSD revenue months before the concert. The protocol acts as a **Single Asset Vault**. The Hook maintains a 20% Liquidity Buffer to handle daily returns. The remaining 80% is automatically routed to the XRPL **Lending Protocol**, generating decentralized yield for the venue. A time-lock recalls all capital 48 hours before the event.

### Privacy & Identity (DID Identity Gate)
The Hook requires that any wallet receiving an MPT must have an attached XRPL **DID** (Decentralized Identifier) with a valid verifiable credential. This is the ultimate defense against Sybil attacks.

## 6. Ecosystem Expansion: The Developer SDK
The protocol is packaged as `@hackathon/ticket-protocol`. 

This SDK abstracts the complex Hook invocations, DID validation, and Multi-Sig coordination into simple methods:
* `Protocol.buyGiftTickets(venueId, payerWallet, [destDid1, destDid2...])`
* `Protocol.initiateSplitBuy(venueId, [wallet1, wallet2...])`
* `Protocol.joinWaitlist(venueId, userWallet, 50)`
* `Protocol.returnTicket(venueId, userWallet, ticketId)`

This allows any independent developer or venue to spin up their own frontend applications while relying on the unbreakable, decentralized backend of the XRPL.
