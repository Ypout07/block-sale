import fs from 'fs';
import path from 'path';
import type { WaitlistEntryRecord } from "@sdk/methods/joinWaitlist";

export type { WaitlistEntryRecord };

const DB_PATH = path.join(process.cwd(), 'waitlist_db.json');

function readDb(): WaitlistEntryRecord[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeDb(entries: WaitlistEntryRecord[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(entries, null, 2));
}

export function addWaitlistEntry(entry: WaitlistEntryRecord) {
  const entries = readDb();
  entries.push(entry);
  writeDb(entries);
}

export function getNextWaitlistEntry(venueId: string, eventId?: string): WaitlistEntryRecord | undefined {
  const entries = readDb();
  return entries.find(e => {
    if (!e.status || e.status !== "active") return false;
    if (eventId) return e.eventId === eventId;
    return e.venueId === venueId;
  });
}

export function markWaitlistAllocated(waitlistId: string) {
  const entries = readDb();
  const entry = entries.find(e => e.waitlistId === waitlistId);
  if (entry) {
    entry.status = "allocated";
    writeDb(entries);
  }
}
