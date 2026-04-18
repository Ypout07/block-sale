#include "utils.h"

int64_t hook(uint32_t reserved) {
  (void)reserved;

  /*
   * Placeholder for the venue pool bouncer hook.
   * Intended behavior:
   * - allow returns to the venue pool
   * - rollback unauthorized peer-to-peer transfers
   */
  return 0;
}
