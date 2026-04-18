#include "utils.h"

/*
 * First milestone for pay_and_claim:
 * - support a "buy_group" instruction that persists a claim assignment
 * - support a later "claim_ticket" instruction that consumes that assignment
 *
 * This file is the right place to prove the HookParameters vs HookState split:
 * purchase instructions are ephemeral, claim assignments are durable.
 *
 * The current implementation is intentionally builder-agnostic. It locks in the
 * protocol state machine and parameter contract now, so the next iteration can
 * swap in the exact Hooks Builder API calls without rethinking the flow.
 */

typedef struct claim_assignment {
  uint8_t ticket_id[32];
  uint8_t recipient[35];
  uint8_t proof[64];
  uint32_t ticket_id_len;
  uint32_t recipient_len;
  uint32_t proof_len;
} claim_assignment_t;

int64_t hook(uint32_t reserved) {
  (void)reserved;

  /*
   * Planned state machine:
   *
   * buy_group:
   * - read PARAM_OPERATION
   * - read PARAM_RECIPIENT
   * - read PARAM_TICKET_ID
   * - optionally read PARAM_PROOF
   * - validate the payload
   * - state_set() a claim assignment under key "claim:<recipient>"
   * - accept the transaction without minting yet
   *
   * claim_ticket:
   * - read PARAM_OPERATION
   * - derive the claimant's state key from the sending account
   * - state_get() the stored claim assignment
   * - validate it exists and matches the requested ticket
   * - emit() the real MPToken transfer from the venue pool
   * - delete the consumed claim assignment from HookState
   * - accept
   *
   * Anything else:
   * - rollback with a clear reason code / message
   */

  /*
   * Local fallback behavior:
   * We return 0 here because this repository does not yet include hookapi.h or
   * the XRPL Hooks Builder compiler. The next iteration should replace this
   * fallback with the actual hook API calls once the builder-side source is
   * wired in.
   */
  return 0;
}
