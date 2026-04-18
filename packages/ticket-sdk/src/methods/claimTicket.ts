export type ClaimTicketInput = {
  venueId: string;
  wallet: string;
  ticketId: string;
};

// Returns an MPTokenAuthorize transaction payload to claim/accept the ticket.
export async function claimTicket(input: ClaimTicketInput, mptAssetId: string): Promise<any> {
  // To receive an MPT wrapped with freeze logic, a user likely needs to 
  // authorize the token issuance to their wallet.
  const authorizeTx = {
    TransactionType: "MPTokenAuthorize", 
    Account: input.wallet,
    MPTokenIssuanceID: mptAssetId,
    Holder: input.wallet, // Some definitions use Holder or simply rely on Account
  };

  return authorizeTx;
}
