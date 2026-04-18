import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ entries: [] });

  const DB_PATH = path.join(process.cwd(), 'waitlist_db.json');
  try {
    if (!fs.existsSync(DB_PATH)) return NextResponse.json({ entries: [] });
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const entries = JSON.parse(data);
    const userEntries = entries.filter((e: any) => e.wallet === wallet);
    return NextResponse.json({ entries: userEntries });
  } catch (e) {
    return NextResponse.json({ entries: [] });
  }
}
