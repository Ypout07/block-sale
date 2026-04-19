import { Client } from "xrpl";

const DEFAULT_XRPL_WS_URL = "wss://s.devnet.rippletest.net:51233";

export function createXrplClient(url = process.env.XRPL_WS_URL || DEFAULT_XRPL_WS_URL) {
  return new Client(url);
}
