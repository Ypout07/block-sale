"use client";

import { useState, useEffect, useRef } from "react";
import { useWalletStore } from "@/store/useWalletStore";

const ALICE = "rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS";
const BOB = "rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z";

export function WalletModal({
  visible,
  onClose,
  onConnect,
}: {
  visible: boolean;
  onClose: () => void;
  onConnect: (address: string) => Promise<unknown>;
}) {
  const { walletAddress, disconnect } = useWalletStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Drag state
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  // Animate in
  const [slideIn, setSlideIn] = useState(false);
  useEffect(() => {
    if (visible) {
      setError("");
      setInput("");
      setDragY(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(true)));
    } else {
      setSlideIn(false);
    }
  }, [visible]);

  // Fetch balance when connected and modal opens
  useEffect(() => {
    if (!visible || !walletAddress) return;
    setBalance(null);
    setBalanceLoading(true);
    fetch(`/api/devnet/wallet/balance?wallet=${walletAddress}`)
      .then(r => r.json())
      .then(d => setBalance(d.balanceRlusd ?? "0.00"))
      .catch(() => setBalance("0.00"))
      .finally(() => setBalanceLoading(false));
  }, [visible, walletAddress]);

  async function handleConnect(addr: string) {
    const trimmed = addr.trim();
    if (!trimmed) return;
    setError("");
    setLoading(true);
    try {
      await onConnect(trimmed);
      setInput("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    onClose();
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientY - startY.current;
    setDragY(delta > 0 ? delta : delta * 0.1);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragY > 120) onClose();
    setDragging(false);
    setDragY(0);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const translateY = slideIn ? (dragY > 0 ? dragY : dragY) : "100%";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        pointerEvents: visible ? "auto" : "none",
        maxWidth: "448px", margin: "0 auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: slideIn ? 1 : 0,
          transition: "opacity 0.4s ease",
          pointerEvents: visible ? "auto" : "none",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative",
          background: "#1C1C1E",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          padding: "20px 24px 48px",
          transform: typeof translateY === "string" ? `translateY(${translateY})` : `translateY(${translateY}px)`,
          transition: dragging ? "none" : "transform 0.5s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            width: "100%", height: 32, margin: "-20px 0 0",
            display: "flex", justifyContent: "center", alignItems: "center",
            cursor: "grab", touchAction: "none",
          }}
        >
          <div style={{
            width: 40, height: 5,
            background: dragging ? "#8E8E93" : "#48484A",
            borderRadius: 3,
            transition: "background 0.2s",
          }} />
        </div>

        {walletAddress ? (
          // ── Connected state ───────────────────────────────────────────────
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                Connected Wallet
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => handleConnect(ALICE)}
                  disabled={loading}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                    color: walletAddress === ALICE ? "#F06E1D" : "rgba(255,255,255,0.3)",
                    fontSize: 13, fontWeight: 700, transition: "color 0.2s" }}
                >Alice</button>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>/</span>
                <button
                  onClick={() => handleConnect(BOB)}
                  disabled={loading}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                    color: walletAddress === BOB ? "#F06E1D" : "rgba(255,255,255,0.3)",
                    fontSize: 13, fontWeight: 700, transition: "color 0.2s" }}
                >Bob</button>
              </div>
            </div>

            {/* Address card */}
            <div style={{ background: "#2C2C2E", borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, margin: "0 0 4px" }}>Address</p>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <p style={{ color: "#fff", fontSize: 13, fontFamily: "monospace", wordBreak: "break-all", margin: 0, lineHeight: 1 }}>
                  {walletAddress}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(walletAddress ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0,
                    color: copied ? "#F06E1D" : "rgba(255,255,255,0.3)",
                    fontSize: 11, fontWeight: 600, transition: "color 0.2s" }}
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>

            {/* Balance card */}
            <div style={{ background: "#2C2C2E", borderRadius: 18, padding: "16px 18px", marginBottom: 24 }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, margin: "0 0 6px" }}>RLUSD Balance</p>
              {balanceLoading ? (
                <div style={{ height: 28, width: 120, borderRadius: 8, background: "rgba(255,255,255,0.08)", animation: "shimmer 1.4s ease infinite" }} />
              ) : (
                <p style={{ color: "#fff", fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1 }}>
                  {balance}
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 500, marginLeft: 6 }}>RLUSD</span>
                </p>
              )}
            </div>

            <button
              onClick={handleDisconnect}
              style={{
                width: "100%", padding: "15px 0",
                borderRadius: 16, border: "none",
                background: "rgba(255,59,48,0.12)",
                color: "#FF3B30",
                fontSize: 16, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          // ── Disconnected state ────────────────────────────────────────────
          <div style={{ marginTop: 16 }}>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Connect Wallet</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 24px" }}>
              Enter your XRPL address or use a demo wallet.
            </p>

            {/* Demo wallets */}
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
              Demo wallets
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <button
                onClick={() => handleConnect(ALICE)}
                disabled={loading}
                style={{
                  flex: 1, padding: "14px 0",
                  borderRadius: 16, border: "none",
                  background: "#2C2C2E",
                  cursor: "pointer",
                }}
              >
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>Alice</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>Payer</p>
              </button>
              <button
                onClick={() => handleConnect(BOB)}
                disabled={loading}
                style={{
                  flex: 1, padding: "14px 0",
                  borderRadius: 16, border: "none",
                  background: "#2C2C2E",
                  cursor: "pointer",
                }}
              >
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>Bob</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>Recipient</p>
              </button>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 24 }} />

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              autoComplete="off"
              spellCheck={false}
              onKeyDown={e => e.key === "Enter" && handleConnect(input)}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#2C2C2E",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16, padding: "14px 16px",
                color: "#fff", fontSize: 14, fontFamily: "monospace",
                outline: "none", marginBottom: 12,
              }}
            />

            {error && (
              <p style={{ color: "#FF3B30", fontSize: 12, marginBottom: 10 }}>{error}</p>
            )}

            <button
              onClick={() => handleConnect(input)}
              disabled={!input.trim() || loading}
              style={{
                width: "100%", padding: "15px 0",
                borderRadius: 16, border: "none",
                background: input.trim() && !loading ? "#F06E1D" : "rgba(255,255,255,0.08)",
                color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize: 16, fontWeight: 700,
                cursor: input.trim() && !loading ? "pointer" : "default",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        )}

        <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    </div>
  );
}
