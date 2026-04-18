export type IssuedAmount = {
  currency: string;
  issuer: string;
  value: string;
};

export type PrimaryPurchaseRequirements = {
  paymentTxHash: string;
  buyerAddress: string;
  vendorAddress: string;
  issuerAddress: string;
  currency?: string;
  minimumAmount: string;
};

export type PaymentApproval = {
  approvalKey: string;
  paymentTxHash: string;
  buyerAddress: string;
  vendorAddress: string;
  issuerAddress: string;
  currency: string;
  deliveredAmount: string;
  ledgerIndex?: number;
};

function decimal(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return parsed;
}

function isIssuedAmount(value: unknown): value is IssuedAmount {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.currency === "string" &&
    typeof candidate.issuer === "string" &&
    typeof candidate.value === "string"
  );
}

export function getDeliveredIssuedAmount(txResult: unknown): IssuedAmount {
  const result = txResult as {
    meta?: { delivered_amount?: unknown };
    tx_json?: { DeliverMax?: unknown; Amount?: unknown };
  };

  const delivered = result.meta?.delivered_amount;
  if (isIssuedAmount(delivered)) {
    return delivered;
  }

  const deliverMax = result.tx_json?.DeliverMax;
  if (isIssuedAmount(deliverMax)) {
    return deliverMax;
  }

  const amount = result.tx_json?.Amount;
  if (isIssuedAmount(amount)) {
    return amount;
  }

  throw new Error("Transaction does not contain an issued-currency delivered amount.");
}

export function assertPrimaryPurchasePayment(
  txResult: unknown,
  requirements: PrimaryPurchaseRequirements
): PaymentApproval {
  const result = txResult as {
    hash?: string;
    ledger_index?: number;
    meta?: { TransactionResult?: string };
    tx_json?: {
      TransactionType?: string;
      Account?: string;
      Destination?: string;
    };
  };

  if (result.meta?.TransactionResult !== "tesSUCCESS") {
    throw new Error(`Payment ${requirements.paymentTxHash} did not succeed.`);
  }

  if (result.tx_json?.TransactionType !== "Payment") {
    throw new Error(`Transaction ${requirements.paymentTxHash} is not a Payment.`);
  }

  if (result.tx_json?.Account !== requirements.buyerAddress) {
    throw new Error("Payment sender does not match the expected buyer.");
  }

  if (result.tx_json?.Destination !== requirements.vendorAddress) {
    throw new Error("Payment destination does not match the expected vendor.");
  }

  const delivered = getDeliveredIssuedAmount(txResult);
  const currency = requirements.currency ?? "USD";

  if (delivered.currency !== currency) {
    throw new Error(`Delivered currency ${delivered.currency} does not match expected ${currency}.`);
  }

  if (delivered.issuer !== requirements.issuerAddress) {
    throw new Error("Delivered issuer does not match the configured RLUSD issuer.");
  }

  if (decimal(delivered.value) < decimal(requirements.minimumAmount)) {
    throw new Error("Delivered amount is below the required minimum purchase amount.");
  }

  return {
    approvalKey: `${requirements.paymentTxHash}:${requirements.buyerAddress}`,
    paymentTxHash: requirements.paymentTxHash,
    buyerAddress: requirements.buyerAddress,
    vendorAddress: requirements.vendorAddress,
    issuerAddress: requirements.issuerAddress,
    currency,
    deliveredAmount: delivered.value,
    ledgerIndex: result.ledger_index
  };
}
