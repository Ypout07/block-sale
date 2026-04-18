import { createXrplClient } from "./client/xrplClient";
import { buyGroupTicket, type BuyGroupTicketInput } from "./methods/buyGroupTicket";
import { claimTicket, type ClaimTicketInput } from "./methods/claimTicket";
import { returnTicket, type ReturnTicketInput } from "./methods/returnTicket";
import { verifyDid } from "./oracle/mockDidVerifier";

export class Protocol {
  constructor(public readonly venueId: string) {}

  createClient(url?: string) {
    return createXrplClient(url);
  }

  async buyGiftTickets(input: BuyGroupTicketInput) {
    return buyGroupTicket(input);
  }

  async claimTicket(input: ClaimTicketInput) {
    return claimTicket(input);
  }

  async returnTicket(input: ReturnTicketInput) {
    return returnTicket(input);
  }

  async verifyWallet(wallet: string) {
    return verifyDid(wallet);
  }
}
