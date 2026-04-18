import type { Payment } from "xrpl";

export type BuyGroupTicketInput = {
  venueId: string;
  payerWallet: string;
  recipients: string[];
  amountRlusd: number;
};

export async function buyGroupTicket(input: BuyGroupTicketInput, rlusdIssuer: string): Promise<Payment> {
  // Convert recipients array to a Hex string representation for the MemoData
  const recipientsData = Buffer.from(JSON.stringify(input.recipients)).toString("hex");

  const paymentTx: Payment = {
    TransactionType: "Payment",
    Account: input.payerWallet,
    Destination: input.venueId,
    Amount: {
      currency: "USD", // Representing RLUSD
      value: input.amountRlusd.toString(),
      issuer: rlusdIssuer
    },
    Memos: [
      {
        Memo: {
          MemoType: Buffer.from("GroupTicketRecipients").toString("hex"),
          MemoFormat: Buffer.from("application/json").toString("hex"),
          MemoData: recipientsData
        }
      }
    ]
  };

  return paymentTx;
}
