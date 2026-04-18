#ifndef XRPL_TICKETING_UTILS_H
#define XRPL_TICKETING_UTILS_H

#include <stdint.h>

typedef struct hook_param_view {
  const uint8_t *ptr;
  uint32_t len;
} hook_param_view_t;

static inline hook_param_view_t empty_param(void) {
  hook_param_view_t view = {0, 0};
  return view;
}

#endif
