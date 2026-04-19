"use client";

import { useEffect, useRef, useState } from "react";
import { SharedNavBar } from "@/components/SharedNavBar";
import { WalletModal } from "@/components/WalletModal";
import { useProtocol } from "@/hooks/useProtocol";

type ScanResult = {
  valid: boolean;
  ticketId?: string;
  wallet?: string;
  venueId?: string;
  redeemedAt?: string;
  error?: string;
};

function IconCheck() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function DashboardPage() {
  const { connectWallet } = useProtocol();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const readerDivId = "qr-reader";

  useEffect(() => {
    if (!scanning) return;

    let stopped = false;

    async function init() {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(readerDivId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (text) => {
            if (stopped) return;
            stopped = true;
            try {
              await scanner.stop();
            } catch {}
            scannerRef.current = null;
            setScanning(false);
            await submitQr(text);
          },
          () => {}
        );
      } catch {
        setScanning(false);
        setResult({ valid: false, error: "Camera access denied or unavailable." });
      }
    }

    init();

    return () => {
      stopped = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanning]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitQr = async (text: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/devnet/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeText: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ valid: true, ...data });
      } else {
        setResult({ valid: false, error: data.error ?? "Redemption failed." });
      }
    } catch {
      setResult({ valid: false, error: "Network error — could not reach server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto pb-24" style={{ background: "#000" }}>
      <div className="pt-14 pb-4 px-4">
        <h1 className="text-[28px] font-bold text-white tracking-tight">Venue Scanner</h1>
        <p className="text-[14px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          Scan attendee QR codes to validate and mark tickets as used.
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8">
        {/* Camera viewport */}
        <div
          id={readerDivId}
          style={{
            width: "100%",
            maxWidth: 360,
            borderRadius: 20,
            overflow: "hidden",
            display: scanning ? "block" : "none",
            background: "#1C1C1E",
          }}
        />

        {loading && (
          <div className="flex flex-col items-center gap-4">
            <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#F06E1D", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>Validating ticket…</p>
          </div>
        )}

        {result && !loading && (
          <div
            style={{
              width: "100%", borderRadius: 24,
              background: result.valid ? "rgba(48,209,88,0.08)" : "rgba(255,59,48,0.08)",
              border: `1px solid ${result.valid ? "rgba(48,209,88,0.3)" : "rgba(255,59,48,0.3)"}`,
              padding: "28px 24px",
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                  background: result.valid ? "rgba(48,209,88,0.15)" : "rgba(255,59,48,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {result.valid ? <IconCheck /> : <IconX />}
              </div>
              <div>
                <p style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
                  {result.valid ? "Ticket Valid" : "Scan Failed"}
                </p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "4px 0 0" }}>
                  {result.valid ? "Marked as used on server" : result.error}
                </p>
              </div>
            </div>

            {result.valid && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <Row label="Ticket ID" value={result.ticketId ?? ""} mono />
                <Row label="Wallet" value={`${result.wallet?.slice(0, 8)}…${result.wallet?.slice(-6)}`} mono />
                <Row label="Redeemed" value={result.redeemedAt ? new Date(result.redeemedAt).toLocaleTimeString() : ""} />
              </div>
            )}

            <button
              onClick={() => { setResult(null); setScanning(true); }}
              style={{
                marginTop: 4,
                background: result.valid ? "#30D158" : "#FF3B30",
                color: "#fff", border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 600,
                padding: "14px 0", width: "100%", cursor: "pointer",
              }}
            >
              Scan Next
            </button>
          </div>
        )}
      </div>

      <SharedNavBar onWalletClick={() => setWalletModalOpen(true)} forceVisible />

      <WalletModal
        visible={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={connectWallet}
      />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#fff", fontSize: 13, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
