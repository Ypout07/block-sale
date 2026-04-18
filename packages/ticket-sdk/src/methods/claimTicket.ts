export type ClaimTicketInput = {
  venueId: string;
  wallet: string;
  ticketId: string;
};

export async function claimTicket(input: ClaimTicketInput) {
  return {
    action: "claimTicket",
    status: "stub",
    input
  };
}
