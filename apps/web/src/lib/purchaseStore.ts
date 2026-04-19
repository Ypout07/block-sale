import fs from 'fs';
import path from 'path';

export type PurchaseRecord = {
  purchaseId: string;
  buyerWallet: string;
  recipientWallet: string;
  eventId: string;
  purchasedAt: string;
  status: "delivered" | "pending_claim" | "returned";
  claimId?: string;
  returnedAt?: string;
};

const DB_PATH = path.join(process.cwd(), 'purchases_db.json');

function readDb(): PurchaseRecord[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeDb(records: PurchaseRecord[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2));
}

export function addPurchaseRecord(record: PurchaseRecord) {
  const records = readDb();
  records.push(record);
  writeDb(records);
}

export function getPurchasesByWallet(wallet: string): PurchaseRecord[] {
  return readDb().filter(r => r.recipientWallet === wallet);
}

export function markPurchaseClaimed(claimId: string) {
  const records = readDb();
  const r = records.find(r => r.claimId === claimId);
  if (r) {
    r.status = "delivered";
    writeDb(records);
  }
}

export function markPurchaseReturned(purchaseId: string) {
  const records = readDb();
  const r = records.find(r => r.purchaseId === purchaseId);
  if (r) {
    r.status = "returned";
    r.returnedAt = new Date().toISOString();
    writeDb(records);
  }
}
