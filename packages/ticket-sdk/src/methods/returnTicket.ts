export type ReturnTicketInput = {
  venueId: string;
  wallet: string;
  ticketId: string;
};

export async function returnTicket(input: ReturnTicketInput) {
  return {
    action: "returnTicket",
    status: "stub",
    input
  };
}
