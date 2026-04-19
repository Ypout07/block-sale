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
import {
  joinWaitlist,
  type JoinWaitlistInput,
  type JoinWaitlistResult,
  type JoinWaitlistRuntime,
  type WaitlistEntryRecord
} from "./methods/joinWaitlist.js";
import {
  returnTicket,
  type ReturnTicketBatchPlan,
  type ReturnTicketInput,
  type ReturnTicketResult,
  type ReturnTicketRuntime
} from "./methods/returnTicket.js";
import {
  deletePermissionedDomain,
  setPermissionedDomain,
  type DeletePermissionedDomainInput,
  type PermissionedDomainCredential,
  type PermissionedDomainResult,
  type PermissionedDomainRuntime,
  type SetPermissionedDomainInput
} from "./methods/permissionedDomain.js";
import {
  authenticateWallet,
  mockDidAuthProvider,
  verifyDid,
  type AuthenticateWalletInput,
  type DidAuthProvider,
  type DidVerificationResult,
  type WalletDidAuth
} from "./oracle/mockDidVerifier.js";
import {
  buildCredentialAcceptTx,
  buildCredentialCreateTx,
  createCredentialAuthProvider,
  provisionCredentialAuth,
  verifyCredentialWallet,
  type CredentialAuthProviderConfig,
  type CredentialProvisionResult
} from "./oracle/credentialAuthProvider.js";
import {
  buildOnLedgerStateMemos,
  createOnLedgerStateRuntime,
  type LedgerClient,
  type OnLedgerStateRuntime,
  type PolicyEvent
} from "./runtime/onLedgerState.js";
import {
  createOnLedgerProtocolRuntime,
  type OnLedgerProtocolSubmitters,
  type OnLedgerProtocolRuntime
} from "./runtime/onLedgerProtocolRuntime.js";
import {
  createOnLedgerSdkRuntime,
  type CreateOnLedgerSdkRuntimeInput,
  type LedgerBackedSdkRuntime
} from "./runtime/onLedgerSdkRuntime.js";
export {
  authenticateWallet,
  mockDidAuthProvider,
  type AuthenticateWalletInput,
  type DidAuthProvider,
  type DidVerificationResult,
  type WalletDidAuth
} from "./oracle/mockDidVerifier.js";
export {
  buildCredentialAcceptTx,
  buildCredentialCreateTx,
  createCredentialAuthProvider,
  provisionCredentialAuth,
  verifyCredentialWallet,
  type CredentialAuthProviderConfig,
  type CredentialProvisionResult
} from "./oracle/credentialAuthProvider.js";
export {
  buildOnLedgerStateMemos,
  createOnLedgerStateRuntime,
  type LedgerClient,
  type OnLedgerStateRuntime,
  type PolicyEvent
} from "./runtime/onLedgerState.js";
export {
  createOnLedgerProtocolRuntime,
  type OnLedgerProtocolSubmitters,
  type OnLedgerProtocolRuntime
} from "./runtime/onLedgerProtocolRuntime.js";
export {
  createOnLedgerSdkRuntime,
  type CreateOnLedgerSdkRuntimeInput,
  type LedgerBackedSdkRuntime
} from "./runtime/onLedgerSdkRuntime.js";
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
export {
  type JoinWaitlistInput,
  type JoinWaitlistResult,
  type JoinWaitlistRuntime,
  type WaitlistEntryRecord
} from "./methods/joinWaitlist.js";
export {
  type ReturnTicketBatchPlan,
  type ReturnTicketInput,
  type ReturnTicketResult,
  type ReturnTicketRuntime
} from "./methods/returnTicket.js";
export {
  type DeletePermissionedDomainInput,
  type PermissionedDomainCredential,
  type PermissionedDomainResult,
  type PermissionedDomainRuntime,
  type SetPermissionedDomainInput
} from "./methods/permissionedDomain.js";

export class Protocol {
  public readonly venueId: string;
  public readonly rlusdIssuer: string;
  public readonly mptAssetId: string;
  public readonly didAuthProvider: DidAuthProvider;

  constructor(
    venueId: string,
    rlusdIssuer: string = "rHKhEQp8kK9x3zPqXYx5E9LgTHTQyBhhzE", // Mock/Template issuer
    mptAssetId: string = "",
    didAuthProvider: DidAuthProvider = mockDidAuthProvider
  ) {
    this.venueId = venueId;
    this.rlusdIssuer = rlusdIssuer;
    this.mptAssetId = mptAssetId;
    this.didAuthProvider = didAuthProvider;
  }

  createClient(url?: string) {
    return createXrplClient(url);
  }

  createOnLedgerRuntime(
    state: OnLedgerStateRuntime,
    submitters?: OnLedgerProtocolSubmitters
  ): OnLedgerProtocolRuntime {
    return createOnLedgerProtocolRuntime(state, submitters);
  }

  createLedgerBackedRuntime(input: CreateOnLedgerSdkRuntimeInput): LedgerBackedSdkRuntime {
    return createOnLedgerSdkRuntime(input);
  }

  async buyGiftTickets(input: BuyGroupTicketInput): Promise<BuyGroupTicketResult> {
    return buyGroupTicket(
      {
        ...input,
        runtime: {
          ...input.runtime,
          authProvider: input.runtime?.authProvider ?? this.didAuthProvider
        }
      },
      this.rlusdIssuer,
      this.mptAssetId
    );
  }

  verifyGiftPurchase(plan: BuyGroupTicketPlan, paymentTxResult: unknown): VerifiedGroupTicketPurchase {
    return verifyGroupTicketPurchase(plan, paymentTxResult);
  }

  async claimTicket(input: ClaimTicketInput): Promise<ClaimTicketResult> {
    return claimTicket(
      {
        ...input,
        runtime: {
          ...input.runtime,
          authProvider: input.runtime?.authProvider ?? this.didAuthProvider
        }
      },
      this.mptAssetId
    );
  }

  async generateTicketQr(input: Omit<GenerateTicketQrInput, "issuanceId" | "venueId">): Promise<GenerateTicketQrResult> {
    return generateTicketQr({
      ...input,
      venueId: this.venueId,
      issuanceId: this.mptAssetId
    });
  }

  async redeemTicket(input: RedeemTicketInput): Promise<RedeemTicketResult> {
    return redeemTicket({
      ...input,
      runtime: {
        ...input.runtime,
        authProvider: input.runtime?.authProvider ?? this.didAuthProvider
      }
    });
  }

  async joinWaitlist(input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
    return joinWaitlist({
      ...input,
      runtime: {
        ...input.runtime,
        authProvider: input.runtime?.authProvider ?? this.didAuthProvider
      }
    });
  }

  async returnTicket(input: ReturnTicketInput): Promise<ReturnTicketResult> {
    return returnTicket(
      {
        ...input,
        runtime: {
          ...input.runtime,
          authProvider: input.runtime?.authProvider ?? this.didAuthProvider
        }
      },
      this.mptAssetId
    );
  }

  async setPermissionedDomain(input: SetPermissionedDomainInput): Promise<PermissionedDomainResult> {
    return setPermissionedDomain({
      ...input,
      runtime: {
        ...input.runtime,
        authProvider: input.runtime?.authProvider ?? this.didAuthProvider
      }
    });
  }

  async deletePermissionedDomain(input: DeletePermissionedDomainInput): Promise<PermissionedDomainResult> {
    return deletePermissionedDomain({
      ...input,
      runtime: {
        ...input.runtime,
        authProvider: input.runtime?.authProvider ?? this.didAuthProvider
      }
    });
  }

  async authenticateWallet(input: string | AuthenticateWalletInput): Promise<WalletDidAuth> {
    return this.didAuthProvider.authenticateWallet(typeof input === "string" ? { wallet: input } : input);
  }

  async verifyWallet(wallet: string, didAuth?: WalletDidAuth): Promise<DidVerificationResult> {
    return this.didAuthProvider.verifyWallet({
      wallet,
      artifact: didAuth
    });
  }
}
