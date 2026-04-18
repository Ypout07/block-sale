import { createXrplClient } from "./client/xrplClient.js";
import {
  buyGroupTicket,
  verifyGroupTicketPurchase,
  type BuyGroupTicketInput,
  type BuyGroupTicketPlan,
  type BuyGroupTicketResult,
  type BuyGroupTicketRuntime,
  type GroupTicketRecipientResult,
  type PendingTicketClaim,
  type VerifiedGroupTicketPurchase
} from "./methods/buyGroupTicket.js";
import {
  claimTicket,
  type ClaimTicketInput,
  type ClaimTicketResult,
  type ClaimTicketRuntime,
  type PendingClaimRecord
} from "./methods/claimTicket.js";
import {
  generateTicketQr,
  redeemTicket,
  type GenerateTicketQrInput,
  type GenerateTicketQrResult,
  type RedeemTicketInput,
  type RedeemTicketResult,
  type RedeemTicketRuntime,
  type TicketQrPayload
} from "./methods/redeemTicket.js";
import { returnTicket, type ReturnTicketInput } from "./methods/returnTicket.js";
import { verifyDid } from "./oracle/mockDidVerifier.js";
export {
  assertPrimaryPurchasePayment,
  getDeliveredIssuedAmount,
  type PaymentApproval,
  type PrimaryPurchaseRequirements
} from "./policy/primaryPurchasePolicy.js";
export {
  verifyGroupTicketPurchase,
  type BuyGroupTicketInput,
  type BuyGroupTicketPlan,
  type BuyGroupTicketResult,
  type BuyGroupTicketRuntime,
  type GroupTicketRecipientResult,
  type PendingTicketClaim,
  type VerifiedGroupTicketPurchase
} from "./methods/buyGroupTicket.js";
export {
  type ClaimTicketInput,
  type ClaimTicketResult,
  type ClaimTicketRuntime,
  type PendingClaimRecord
} from "./methods/claimTicket.js";
export {
  generateTicketQr,
  type GenerateTicketQrInput,
  type GenerateTicketQrResult,
  type RedeemTicketInput,
  type RedeemTicketResult,
  type RedeemTicketRuntime,
  type TicketQrPayload
} from "./methods/redeemTicket.js";

export class Protocol {
  public readonly venueId: string;
  public readonly rlusdIssuer: string;
  public readonly mptAssetId: string;

  constructor(
    venueId: string,
    rlusdIssuer: string = "rHKhEQp8kK9x3zPqXYx5E9LgTHTQyBhhzE", // Mock/Template issuer
    mptAssetId: string = ""
  ) {
    this.venueId = venueId;
    this.rlusdIssuer = rlusdIssuer;
    this.mptAssetId = mptAssetId;
  }

  createClient(url?: string) {
    return createXrplClient(url);
  }

  async buyGiftTickets(input: BuyGroupTicketInput): Promise<BuyGroupTicketResult> {
    return buyGroupTicket(input, this.rlusdIssuer, this.mptAssetId);
  }

  verifyGiftPurchase(plan: BuyGroupTicketPlan, paymentTxResult: unknown): VerifiedGroupTicketPurchase {
    return verifyGroupTicketPurchase(plan, paymentTxResult);
  }

  async claimTicket(input: ClaimTicketInput): Promise<ClaimTicketResult> {
    return claimTicket(input, this.mptAssetId);
  }

  async generateTicketQr(input: Omit<GenerateTicketQrInput, "issuanceId" | "venueId">): Promise<GenerateTicketQrResult> {
    return generateTicketQr({
      ...input,
      venueId: this.venueId,
      issuanceId: this.mptAssetId
    });
  }

  async redeemTicket(input: RedeemTicketInput): Promise<RedeemTicketResult> {
    return redeemTicket(input);
  }

  async returnTicket(input: ReturnTicketInput) {
    return returnTicket(input, this.mptAssetId);
  }

  async verifyWallet(wallet: string) {
    return verifyDid(wallet);
  }
}
