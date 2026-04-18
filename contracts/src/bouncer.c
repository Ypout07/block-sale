#include "hookapi.h"

/*
 * Builder-first milestone:
 * - compile as a single self-contained Hook in XRPL Hooks Builder
 * - inspect transactions with a Destination field
 * - allow only transfers whose destination is the issuer / vendor pool account
 *
 * Important:
 * This is intentionally a minimal first pass. The account bytes below are a
 * placeholder until you replace them with the 20-byte AccountID of the issuer
 * account that holds this hook.
 */

int64_t hook(uint32_t reserved)
{
    _g(1, 1);
    (void)reserved;

    int64_t tt = otxn_type();

    /*
     * First compileable scope:
     * only inspect Payment transactions for now.
     * This gives you a real rollback path in Builder before wiring in the exact
     * MPT transaction path you end up using.
     */
    if (tt != ttPAYMENT)
        accept(SBUF("non-payment pass"), 0);

    uint8_t destination[20];
    int64_t dest_len = otxn_field(SBUF(destination), sfDestination);
    if (dest_len < 0)
        rollback(SBUF("missing destination"), 1);

    /*
     * Replace this with the actual 20-byte issuer / vendor pool AccountID.
     * This is not a base58 string. It must be raw account bytes.
     */
    uint8_t vendor_pool[20] = {
        0U, 0U, 0U, 0U, 0U,
        0U, 0U, 0U, 0U, 0U,
        0U, 0U, 0U, 0U, 0U,
        0U, 0U, 0U, 0U, 0U
    };

    for (int i = 0; GUARD(20), i < 20; ++i)
    {
        if (destination[i] != vendor_pool[i])
            rollback(SBUF("blocked: not vendor pool"), 2);
    }

    accept(SBUF("allowed: vendor pool"), 0);
    return 0;
}
