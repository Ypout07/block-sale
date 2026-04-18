# SYSTEM CONTEXT: XRPL "Pay & Claim" Ticketing Protocol
**Target Audience:** AI Coding Agents (Cursor, Copilot, etc.)
**Architecture:** Monorepo (Next.js Frontend, Node/TS SDK, C/Rust Wasm Hooks)
**Network:** XRPL Devnet (`wss://s.devnet.rippletest.net:51233`)

## 1. Directory Boundaries & Responsibilities
* `/apps/web`: Next.js React frontend. **Rule:** Never interact with `xrpl.js` directly. All XRPL logic must be routed through the `@repo/ticket-sdk`.
* `/packages/ticket-sdk`: TypeScript middleware. **Rule:** Responsible for constructing transaction payloads, hex-encoding Hook Parameters, managing Devnet RPC calls, and returning clean JSON to the frontend.
* `/contracts`: C/Rust Wasm Hooks. **Rule:** Responsible for immutable ledger state. Must parse incoming hex parameters, enforce P2P blocking, and mutate `HookState` for the ticket claims.

---

## 2. The Data Contracts (Cross-Directory Communication)

### Contract A: The Group Buy Flow (Alice pays for Bob)
**1. UI -> SDK (The Method Call)**
```typescript
// Called by /apps/web
await Protocol.buyGroupTicket({
  payerWallet: Wallet,       // xrpl.Wallet instance of Alice
  venueAddress: string,      // "rVenue..."
  ticketPrice: 50,           // RLUSD amount per ticket
  friendsToClaim: string[]   // ["rBob...", "rCharlie..."]
});
```

**2. SDK -> XRPL Hook (The Transaction Payload)**
The SDK must construct a `Payment` transaction. The `Amount` must equal `ticketPrice * (1 + friendsToClaim.length)`. The `friendsToClaim` must be mapped into `HookParameters`.
*CRITICAL:* XRPL `HookParameters` require hex-encoded strings for both Name and Value. The SDK must convert standard "r-addresses" to their 20-byte hex Account IDs, or hex-encode the string directly depending on Hook C-logic expectations.
```json
{
  "TransactionType": "Payment",
  "Account": "rAlice...",
  "Destination": "rVenue...",
  "Amount": {
    "currency": "RLUSD",
    "value": "150",
    "issuer": "rIssuer..." 
  },
  "HookParameters": [
    {
      "HookParameter": {
        "HookParameterName": "467269656E6431", // Hex for "Friend1"
        "HookParameterValue": "..."            // Hex for Bob's address
      }
    }
  ]
}
```

**3. Hook Execution (The C/Rust State Mutation)**
When the Wasm Hook intercepts this `Payment`:
1.  Verify the RLUSD amount matches expected inventory.
2.  Use `emit()` to create an `MPTokenTransfer` sending 1 MPT to `Account` (Alice).
3.  Loop through `HookParameters`. For each friend's address:
    * Call `state_set()`.
    * `Key` = Friend's 20-byte Account ID.
    * `Value` = `0x01` (Integer 1, representing tickets owed).

---

### Contract B: The Claim Flow (Bob accepts the ticket)
**1. UI -> SDK (The State Check)**
When Bob logs into `/apps/web`, the UI checks if he has pending tickets.
```typescript
// SDK queries the ledger via `ledger_entry` RPC
const hasPending = await Protocol.checkPendingClaims("rBob..."); 
```
*SDK Implementation Note:* Use `ledger_entry` with `type: "hook_state"`. Look up the key corresponding to Bob's hex address on the Venue's Hook.

**2. UI -> SDK (The Execution)**
```typescript
await Protocol.claimTicket({
  claimerWallet: Wallet,    // Bob's xrpl.Wallet
  venueAddress: string
});
```

**3. SDK -> XRPL Hook (The Transaction Payload)**
The SDK must construct a **0-Drop Payment**. This is a dummy transaction used purely to trigger the Venue's Wasm Hook without spending money.
```json
{
  "TransactionType": "Payment",
  "Account": "rBob...",
  "Destination": "rVenue...",
  "Amount": "0" // 0 Drops of XRP
}
```

**4. Hook Execution (The C/Rust State Mutation)**
When the Wasm Hook intercepts this 0-value `Payment`:
1.  Read the sender's Account ID (`rBob...`).
2.  Call `state(read)`. Check if `rBob...` exists as a Key in `HookState`.
3.  If NOT found: call `rollback("No tickets owed to this address.")`.
4.  If FOUND:
    * Use `emit()` to create an `MPTokenTransfer` sending 1 MPT to Bob.
    * Call `state_set()` with empty data to DELETE the state key, preventing double-claims.

---

### Contract C: The Bouncer (Anti-Scalping)
This Hook logic executes whenever *any* `MPTokenTransfer` occurs involving the Venue's MPT asset ID.

**Hook Execution:**
1. Check `otxn_type()`. If it is an `MPTokenTransfer`:
2. Parse the `Destination` field.
3. IF `Destination` != Venue Address:
   * Execute `rollback("Protocol Violation: Peer-to-Peer transfers are strictly blocked. Return ticket to Venue Pool.")`
4. IF `Destination` == Venue Address:
   * (Standard Return Flow) Accept the transaction, calculate 98% RLUSD face value, and `emit()` a `Payment` refunding the original sender.

## 3. General AI Agent Guidelines
* **XRPL.js Version:** Assume the latest version of `xrpl.js` supporting MPTokens (`MPTokenIssuanceCreate`, `MPTokenTransfer`).
* **Hook Compilation:** C/Rust Hook files should not assume standard standard libraries (`stdlib`) are available. Use XRPL Hook API macros (`hook_api.h`).
* **Ledger Asynchrony:** Frontend AI agents must implement 3-5 second loading states when awaiting SDK promises, as XRPL ledger consensus requires time. Do not assume instant state mutations.
