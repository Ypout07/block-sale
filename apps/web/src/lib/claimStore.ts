import fs from 'fs';
import path from 'path';

export type PendingClaim = {
  claimId: string;
  venueId: string;
  buyerAddress: string;
  recipientWallet: string;
  amountRlusd: string;
  status: "pending_authorization" | "claimed";
  createdAt: string;
  issuanceId: string;
};

// Use a fixed absolute path in the project root to avoid confusion
const DB_PATH = path.join(process.cwd(), 'claims_db.json');

function readDb(): PendingClaim[] {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('ClaimDB: No database file found at', DB_PATH);
      return [];
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    console.log(`ClaimDB: Read ${parsed.length} claims from ${DB_PATH}`);
    return parsed;
  } catch (e) {
    console.error('ClaimDB: Error reading database', e);
    return [];
  }
}

function writeDb(claims: PendingClaim[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(claims, null, 2));
    console.log(`ClaimDB: Successfully wrote ${claims.length} claims to ${DB_PATH}`);
  } catch (e) {
    console.error('ClaimDB: Error writing database', e);
  }
}

export function addPendingClaim(claim: PendingClaim) {
  console.log('ClaimDB: Adding pending claim for', claim.recipientWallet);
  const claims = readDb();
  claims.push(claim);
  writeDb(claims);
}

export function getPendingClaims(wallet: string) {
  const claims = readDb();
  const filtered = claims.filter(c => c.recipientWallet === wallet);
  console.log(`ClaimDB: Found ${filtered.length} pending claims for ${wallet}`);
  return filtered;
}

export function markClaimed(claimId: string) {
  const claims = readDb();
  const claim = claims.find(c => c.claimId === claimId);
  if (claim) {
    claim.status = "claimed";
    writeDb(claims);
    console.log('ClaimDB: Marked claim', claimId, 'as claimed');
  }
}
