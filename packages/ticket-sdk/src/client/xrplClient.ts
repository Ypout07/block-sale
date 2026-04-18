import { Client } from "xrpl";

export function createXrplClient(url = "wss://s.devnet.rippletest.net:51233") {
  return new Client(url);
}
