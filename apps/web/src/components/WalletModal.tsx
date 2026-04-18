"use client";

import { useState } from "react";

const DEMO_ADDRESS = "rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS";

export function WalletModal({
  visible,
  onClose,
  onConnect,
}: {
  visible: boolean;
  onClose: () => void;
  onConnect: (address: string) => Promise<unknown>;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    const addr = input.trim();
    if (!addr) return;
    setError("");
    setLoading(true);
    try {
      await onConnect(addr);
      setInput("");
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoAlice() {
    setInput("rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS");
  }

  function handleDemoBob() {
    setInput("rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z");
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] max-w-md mx-auto flex items-end" style={{ pointerEvents: "auto" }}>
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full rounded-t-3xl px-6 pt-5 pb-10"
        style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>
        <h2 className="text-white text-[20px] font-bold mb-1">Connect Wallet</h2>
        <p className="text-[13px] mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Enter your XRPL classic address to get started.
        </p>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          autoComplete="off"
          spellCheck={false}
          className="w-full text-white text-[14px] rounded-2xl px-4 py-3.5 outline-none mb-3"
          style={{
            background: "#2C2C2E",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "monospace",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
        />

        {error && (
          <p className="text-[12px] mb-3" style={{ color: "#c0392b" }}>{error}</p>
        )}

        <button
          onClick={handleConnect}
          disabled={!input.trim() || loading}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] mb-3"
          style={{
            background: input.trim() && !loading ? "#F06E1D" : "rgba(255,255,255,0.08)",
            color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.25)",
          }}
        >
          {loading ? "Connecting…" : "Connect"}
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleDemoAlice}
            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            Alice (Payer)
          </button>
          <button
            onClick={handleDemoBob}
            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            Bob (Friend)
          </button>
        </div>
      </div>
    </div>
  );
}
