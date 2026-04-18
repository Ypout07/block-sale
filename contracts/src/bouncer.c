#include "hookapi.h"

/*
 * Primary purchase firewall:
 * - incoming RLUSD-like payment into the vendor account records approval state
 * - outgoing MPT payment from the vendor account requires that approval state
 * - approval is consumed when the MPT is released
 *
 * This removes the earlier runtime-intent dependency. The rule becomes:
 * "money in first, ticket out second."
 *
 * Install-time Hook Parameters expected on the hook:
 * - RLU: 20 raw bytes of the mock RLUSD issuer AccountID
 * - ISS: 24 raw bytes of the MPTokenIssuanceID for the ticket issuance
 */

int64_t hook(uint32_t reserved)
{
    _g(1, 1);
    (void)reserved;

    int64_t tt = otxn_type();
    if (tt != ttPAYMENT)
        accept(SBUF("non-payment pass"), 0);

    uint8_t hook_acc[20];
    int64_t hook_len = hook_account(SBUF(hook_acc));
    if (hook_len != 20)
        rollback(SBUF("hook_account failed"), 2);

    uint8_t rlu_name[3] = {'R', 'L', 'U'};
    uint8_t rlu_issuer[20];
    int64_t rlu_len = hook_param(SBUF(rlu_issuer), SBUF(rlu_name));
    if (rlu_len != 20)
        rollback(SBUF("missing RLU hook param"), 20);

    uint8_t iss_name[3] = {'I', 'S', 'S'};
    uint8_t issuance_id[24];
    int64_t iss_len = hook_param(SBUF(issuance_id), SBUF(iss_name));
    if (iss_len != 24)
        rollback(SBUF("missing ISS hook param"), 21);

    uint8_t sender[20];
    int64_t sender_len = otxn_field(SBUF(sender), sfAccount);
    if (sender_len != 20)
        rollback(SBUF("missing sender"), 1);

    int sender_is_hook = 1;
    for (int i = 0; GUARD(20), i < 20; ++i)
    {
        if (sender[i] != hook_acc[i])
        {
            sender_is_hook = 0;
            break;
        }
    }

    uint8_t destination[20];
    int64_t dest_len = otxn_field(SBUF(destination), sfDestination);
    if (dest_len < 0)
        rollback(SBUF("missing destination"), 1);

    uint8_t amount[128];
    int64_t amount_len = otxn_field(SBUF(amount), sfAmount);
    if (amount_len < 0)
        rollback(SBUF("missing Amount"), 15);

    /*
     * State key format:
     * 12-byte prefix + 20-byte account = 32 bytes
     */
    uint8_t state_key[32] = {
        'B','U','Y','_','A','P','P','R','O','V','E','D',
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
    };

    /*
     * Incoming payment to vendor:
     * if Amount contains the configured RLUSD issuer bytes, record approval for
     * the sender account.
     */
    if (!sender_is_hook)
    {
        int is_to_hook = 1;
        for (int i = 0; GUARD(20), i < 20; ++i)
        {
            if (destination[i] != hook_acc[i])
            {
                is_to_hook = 0;
                break;
            }
        }

        if (!is_to_hook)
            accept(SBUF("incoming not for hook"), 0);

        int found_rlu_issuer = 0;
        for (int start = 0; GUARD(128), start <= (amount_len - 20); ++start)
        {
            int matches = 1;
            for (int j = 0; GUARD(20), j < 20; ++j)
            {
                if (amount[start + j] != rlu_issuer[j])
                {
                    matches = 0;
                    break;
                }
            }

            if (matches)
            {
                found_rlu_issuer = 1;
                break;
            }
        }

        if (!found_rlu_issuer)
            accept(SBUF("incoming non-rlusd pass"), 0);

        for (int i = 0; GUARD(20), i < 20; ++i)
            state_key[12 + i] = sender[i];

        if (state_set(issuance_id, 24, state_key, 32) < 0)
            rollback(SBUF("state_set approval failed"), 30);

        accept(SBUF("approved buyer payment"), 0);
    }

    /*
     * Outgoing payment from vendor:
     * if it is not the configured MPT issuance, ignore it for now.
     * if it is the configured MPT issuance, require existing approval state for
     * the destination and consume it.
     */
    int found_issuance = 0;
    for (int start = 0; GUARD(128), start <= (amount_len - 24); ++start)
    {
        int matches = 1;
        for (int j = 0; GUARD(24), j < 24; ++j)
        {
            if (amount[start + j] != issuance_id[j])
            {
                matches = 0;
                break;
            }
        }

        if (matches)
        {
            found_issuance = 1;
            break;
        }
    }

    if (!found_issuance)
        accept(SBUF("outgoing non-ticket pass"), 0);

    for (int i = 0; GUARD(20), i < 20; ++i)
        state_key[12 + i] = destination[i];

    uint8_t approval_value[32];
    int64_t approval_len = state(approval_value, 32, state_key, 32);
    if (approval_len != 24)
        rollback(SBUF("blocked: buyer not approved"), 31);

    for (int i = 0; GUARD(24), i < 24; ++i)
    {
        if (approval_value[i] != issuance_id[i])
            rollback(SBUF("blocked: approval issuance mismatch"), 32);
    }

    if (state_set(0, 0, state_key, 32) < 0)
        rollback(SBUF("approval consume failed"), 33);

    accept(SBUF("allowed: paid buyer gets ticket"), 0);
    return 0;
}
