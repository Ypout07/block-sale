import { NextResponse } from "next/server";
import { Protocol } from "@xrpl-ticketing/ticket-sdk";

export async function POST(req: Request) {
  try {
    const { data } = await req.json();

    if (!data) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    // Try to parse the scanned QR code text
    let qrPayload;
    try {
      qrPayload = JSON.parse(data);
    } catch (e) {
      // If it's not JSON, it might be the old fernet mock. We reject it now that we use the SDK.
      throw new Error("Invalid QR code format. Expected JSON payload from SDK.");
    }

    // Instantiate protocol with the venue ID from the payload
    const protocol = new Protocol(qrPayload.venueId);

    // Use the SDK to confirm the QR code is valid
    const result = await protocol.redeemTicket({
      ticketId: qrPayload.ticketId,
      wallet: qrPayload.wallet,
      venueId: qrPayload.venueId,
      qrCodeText: data,
      didAuth: {
        schemaVersion: 1,
        subjectType: "human-to-wallet",
        wallet: qrPayload.wallet,
        provider: qrPayload.didProvider,
        authToken: qrPayload.didToken,
        subjectIdHash: "mock-hash",
        verifiedAt: qrPayload.issuedAt,
        expiresAt: qrPayload.expiresAt
      } as any,
      runtime: {
        authProvider: {
          authenticateWallet: async () => ({} as any),
          verifyWallet: async () => ({
            wallet: qrPayload.wallet,
            verified: true,
            provider: qrPayload.didProvider
          })
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      decoded: result 
    });

  } catch (error: any) {
    console.error("SDK Validation error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Invalid or unauthorized QR code" 
    }, { status: 401 });
  }
}

