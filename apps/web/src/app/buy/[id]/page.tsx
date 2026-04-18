"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ALL_EVENTS } from "@/data/events";
import { useWalletStore } from "@/store/useWalletStore";

type Slot = { forMe: boolean; wallet: string };

export default function BuyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const walletAddress = useWalletStore(s => s.walletAddress);
  const event = ALL_EVENTS.find(e => e.id === id);

  const [mounted, setMounted] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [slots, setSlots] = useState<Slot[]>([{ forMe: true, wallet: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSlots(prev => {
      if (quantity > prev.length) {
        const added: Slot[] = Array.from({ length: quantity - prev.length }, () => ({ forMe: false, wallet: "" }));
        return [...prev, ...added];
      }
      const next = prev.slice(0, quantity);
      if (!next.some(s => s.forMe) && next.length > 0) {
        next[0] = { ...next[0], forMe: true, wallet: "" };
      }
      return next;
    });
  }, [quantity]);

  if (!event) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>Event not found.</p>
      </div>
    );
  }

  const myWallet = walletAddress ?? "rYourWalletAddress";
  const total = quantity * event.price;
  const canBuy = slots.every(s => s.forMe || s.wallet.trim().length > 0);

  const setForMe = (i: number, val: boolean) => {
    if (val) {
      setSlots(prev => prev.map((s, idx) => ({
        forMe: idx === i,
        wallet: idx === i ? "" : s.wallet,
      })));
    } else {
      setSlots(prev => prev.map((s, idx) =>
        idx === i ? { forMe: false, wallet: "" } : s
      ));
    }
  };

  const setWallet = (i: number, wallet: string) => {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, wallet } : s));
  };

  const handleBuy = async () => {
    setSubmitting(true);
    const recipients = slots.map(s => s.forMe ? myWallet : s.wallet.trim());
    console.log("buyGroupTicket", { venueId: event.id, payerWallet: myWallet, recipients, amountRlusd: total });
    await new Promise(r => setTimeout(r, 1600));
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "#000",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 20, padding: 32,
        }}
      >
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(52,199,89,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>Purchase Confirmed</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 8 }}>
            {quantity === 1 ? "Your ticket is on its way." : `${quantity} tickets are on their way.`}
          </p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 4 }}>
            Recipients will receive a claim link.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 12, padding: "14px 32px",
            borderRadius: 14, border: "none",
            background: "#F06E1D", color: "#fff",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}
        >
          Back to Events
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>

      {/* Hero — top ~28% */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "28dvh",
          backgroundImage: `url(${event.photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          transformOrigin: "50% 0%",
          transform: mounted ? "scale(1)" : "scale(0.88)",
          borderRadius: mounted ? 0 : "20px",
          opacity: mounted ? 1 : 0,
          transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease, border-radius 0.5s ease",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, rgba(${event.tint},0.65) 0%, rgba(0,0,0,0.78) 100%)`,
          }}
        >
          {/* Back button */}
          <button
            onClick={() => router.back()}
            style={{
              position: "absolute", top: 52, left: 20,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(12px)",
              border: "none", borderRadius: "50%",
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Event info */}
          <div style={{ position: "absolute", bottom: 18, left: 20, right: 20 }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 3 }}>
              {event.trending}
            </p>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, lineHeight: 1.1, margin: 0 }}>{event.name}</h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, margin: "3px 0 0" }}>{event.subtitle}</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, margin: "4px 0 0" }}>
              {event.date} &middot; {event.venue.split("·")[0].trim()}
            </p>
          </div>
        </div>
      </div>

      {/* Form sheet */}
      <div
        style={{
          position: "absolute",
          top: "25dvh", left: 0, right: 0, bottom: 0,
          background: "#1C1C1E",
          borderRadius: "20px 20px 0 0",
          transform: mounted ? "translateY(0)" : "translateY(110%)",
          transition: "transform 0.52s cubic-bezier(0.32,0.72,0,1)",
          transitionDelay: "0.04s",
          overflowY: "auto",
          paddingBottom: 108,
        }}
      >
        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 6 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
        </div>

        <div style={{ padding: "12px 20px 0" }}>

          {/* Quantity stepper */}
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>How many tickets?</p>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "#2C2C2E", border: "none",
                color: "#fff", fontSize: 24, fontWeight: 300,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >−</button>
            <span style={{ color: "#fff", fontSize: 30, fontWeight: 700, minWidth: 36, textAlign: "center" }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(q => Math.min(8, q + 1))}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "#2C2C2E", border: "none",
                color: "#fff", fontSize: 24, fontWeight: 300,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >+</button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
              × {event.price} RLUSD ea.
            </span>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 22 }} />

          {/* Ticket slots */}
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>Who are the tickets for?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slots.map((slot, i) => (
              <div
                key={i}
                style={{ background: "#2C2C2E", borderRadius: 16, padding: "14px 16px" }}
              >
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 10px" }}>
                  Ticket #{i + 1}
                </p>
                {/* Toggle pill */}
                <div style={{ display: "flex", background: "#111", borderRadius: 10, padding: 3, marginBottom: slot.forMe ? 0 : 10 }}>
                  <button
                    onClick={() => setForMe(i, true)}
                    style={{
                      flex: 1, padding: "8px 0",
                      borderRadius: 8, border: "none",
                      background: slot.forMe ? "#F06E1D" : "transparent",
                      color: slot.forMe ? "#fff" : "rgba(255,255,255,0.35)",
                      fontSize: 13, fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 0.18s ease, color 0.18s ease",
                    }}
                  >
                    For me
                  </button>
                  <button
                    onClick={() => setForMe(i, false)}
                    style={{
                      flex: 1, padding: "8px 0",
                      borderRadius: 8, border: "none",
                      background: !slot.forMe ? "#F06E1D" : "transparent",
                      color: !slot.forMe ? "#fff" : "rgba(255,255,255,0.35)",
                      fontSize: 13, fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 0.18s ease, color 0.18s ease",
                    }}
                  >
                    For someone else
                  </button>
                </div>
                {/* Wallet input */}
                {!slot.forMe && (
                  <input
                    placeholder="Their wallet address (rXXXXXX...)"
                    value={slot.wallet}
                    onChange={e => setWallet(i, e.target.value)}
                    style={{
                      width: "100%",
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Total row */}
          <div
            style={{
              marginTop: 18, padding: "14px 16px",
              background: "#2C2C2E", borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: "0 0 2px" }}>Total</p>
              <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>{total} RLUSD</p>
            </div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
              {quantity} × {event.price}
            </p>
          </div>
        </div>
      </div>

      {/* Fixed confirm button */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          padding: "16px 20px 40px",
          background: "linear-gradient(to top, #1C1C1E 65%, transparent)",
          transform: mounted ? "translateY(0)" : "translateY(110%)",
          transition: "transform 0.52s cubic-bezier(0.32,0.72,0,1)",
          transitionDelay: "0.06s",
        }}
      >
        <button
          onClick={handleBuy}
          disabled={!canBuy || submitting}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 14,
            border: "none",
            background: canBuy && !submitting ? "#F06E1D" : "rgba(255,255,255,0.08)",
            color: canBuy && !submitting ? "#fff" : "rgba(255,255,255,0.25)",
            fontSize: 17,
            fontWeight: 700,
            cursor: canBuy && !submitting ? "pointer" : "default",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          {submitting ? "Processing..." : `Confirm Purchase · ${total} RLUSD`}
        </button>
      </div>
    </div>
  );
}
