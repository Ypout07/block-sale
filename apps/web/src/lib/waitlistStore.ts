import fs from 'fs';
import path from 'path';

export type WaitlistEntry = {
  waitlistId: string;
  venueId: string;
  wallet: string;
  status: "pending" | "allocated" | "expired";
  createdAt: string;
};

const DB_PATH = path.join(process.cwd(), 'waitlist_db.json');

function readDb(): WaitlistEntry[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function writeDb(entries: WaitlistEntry[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(entries, null, 2));
}

export function addWaitlistEntry(entry: WaitlistEntry) {
  const entries = readDb();
  entries.push(entry);
  writeDb(entries);
}

export function getNextWaitlistEntry(venueId: string) {
  const entries = readDb();
  return entries.find(e => e.venueId === venueId && e.status === "pending");
}

export function markWaitlistAllocated(waitlistId: string) {
  const entries = readDb();
  const entry = entries.find(e => e.waitlistId === waitlistId);
  if (entry) {
    entry.status = "allocated";
    writeDb(entries);
  }
}
