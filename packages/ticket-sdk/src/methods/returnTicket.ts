import type { Payment } from "xrpl";

export type ReturnTicketInput = {
  venueId: string;
  wallet: string;
  ticketId: string;
};

// Returns an MPT specific Payment payload to transfer ticket back to Venue
export async function returnTicket(input: ReturnTicketInput, mptAssetId: string): Promise<any> {
  const returnTx = {
    TransactionType: "Payment",
    Account: input.wallet,
    Destination: input.venueId,
    Amount: {
      mpt_issuance_id: mptAssetId,
      value: "1" // Standard fungible/semi-fungible return, returning 1 MPT unit
    }
  };

  return returnTx;
}
