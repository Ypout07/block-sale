export type BuyGroupTicketInput = {
  venueId: string;
  payerWallet: string;
  recipients: string[];
  amountRlusd: number;
};

export async function buyGroupTicket(input: BuyGroupTicketInput) {
  return {
    action: "buyGroupTicket",
    status: "stub",
    input
  };
}
