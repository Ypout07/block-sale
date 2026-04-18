#ifndef XRPL_TICKETING_UTILS_H
#define XRPL_TICKETING_UTILS_H

#include <stdint.h>

typedef enum protocol_operation {
  OP_INVALID = 0,
  OP_BUY_GROUP = 1,
  OP_CLAIM_TICKET = 2
} protocol_operation_t;

/*
 * These names are the protocol-level contract between the frontend / SDK and
 * the hook logic. Keep them small and stable because they must be encoded into
 * HookParameters.
 */
#define PARAM_OPERATION "op"
#define PARAM_RECIPIENT "recipient"
#define PARAM_PROOF "proof"
#define PARAM_TICKET_ID "ticket_id"

/*
 * HookState stores durable claim assignments keyed by recipient account.
 * The first milestone only needs one persistent fact:
 * "this account has a claimable ticket for this event / issuance."
 */
#define STATE_PREFIX_CLAIM "claim:"

#endif
