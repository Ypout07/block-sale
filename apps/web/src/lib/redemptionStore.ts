import fs from 'fs';
import path from 'path';

export type RedeemedTicket = {
  ticketId: string;
  wallet: string;
  venueId: string;
  issuanceId: string;
  redeemedAt: string;
  redemptionHash: string;
};

const DB_PATH = path.join(process.cwd(), 'redemptions_db.json');

function readDb(): RedeemedTicket[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeDb(records: RedeemedTicket[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2));
}

export function isAlreadyRedeemed(ticketId: string): RedeemedTicket | null {
  return readDb().find(r => r.ticketId === ticketId) ?? null;
}

export function markRedeemed(record: RedeemedTicket) {
  const records = readDb();
  records.push(record);
  writeDb(records);
}
