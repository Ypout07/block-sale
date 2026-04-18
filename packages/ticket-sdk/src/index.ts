import { createXrplClient } from "./client/xrplClient";
import { buyGroupTicket, type BuyGroupTicketInput } from "./methods/buyGroupTicket";
import { claimTicket, type ClaimTicketInput } from "./methods/claimTicket";
import { returnTicket, type ReturnTicketInput } from "./methods/returnTicket";
import { verifyDid } from "./oracle/mockDidVerifier";

export class Protocol {
  constructor(
    public readonly venueId: string,
    public readonly rlusdIssuer: string = "rHKhEQp8kK9x3zPqXYx5E9LgTHTQyBhhzE", // Mock/Template issuer
    public readonly mptAssetId: string = ""
  ) {}

  createClient(url?: string) {
    return createXrplClient(url);
  }

  async buyGiftTickets(input: BuyGroupTicketInput) {
    return buyGroupTicket(input, this.rlusdIssuer);
  }

  async claimTicket(input: ClaimTicketInput) {
    return claimTicket(input, this.mptAssetId);
  }

  async returnTicket(input: ReturnTicketInput) {
    return returnTicket(input, this.mptAssetId);
  }

  async verifyWallet(wallet: string) {
    return verifyDid(wallet);
  }
}
