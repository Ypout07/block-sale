export type PendingClaim = {
  claimId: string;
  venueId: string;
  buyerAddress: string;
  recipientWallet: string;
  amountRlusd: string;
  status: "pending_authorization" | "claimed";
  createdAt: string;
  issuanceId: string;
};

// In-memory store for demo purposes
// In a real app, this would be a database.
const globalClaims = global as unknown as { __pending_claims: PendingClaim[] };
if (!globalClaims.__pending_claims) {
  globalClaims.__pending_claims = [];
}

export function addPendingClaim(claim: PendingClaim) {
  globalClaims.__pending_claims.push(claim);
}

export function getPendingClaims(wallet: string) {
  return globalClaims.__pending_claims.filter(c => c.recipientWallet === wallet);
}

export function markClaimed(claimId: string) {
  const claim = globalClaims.__pending_claims.find(c => c.claimId === claimId);
  if (claim) {
    claim.status = "claimed";
  }
}
