"use client";

import { useEffect, useState } from "react";
import { type Event } from "@/data/events";
import { useWalletStore } from "@/store/useWalletStore";

type Slot = { forMe: boolean; wallet: string };

type Props = {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
};

export function BuyOverlay({ event, visible, onClose }: Props) {
  const walletAddress = useWalletStore(s => s.walletAddress);
  const [quantity, setQuantity] = useState(1);
  const [slots, setSlots] = useState<Slot[]>([{ forMe: true, wallet: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (event) {
      setQuantity(1);
      setSlots([{ forMe: true, wallet: "" }]);
      setSubmitting(false);
      setDone(false);
    }
  }, [event?.id]);

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

  if (!event) return null;

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
          position: "fixed", inset: 0, zIndex: 100,
          background: "#000",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 20, padding: 32,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.52s cubic-bezier(0.32,0.72,0,1)",
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
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 4 }}>
            Recipients will receive a claim link.
          </p>
        </div>
        <button
          onClick={onClose}
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
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", flexDirection: "column",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.52s cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      {/* Photo covers the entire overlay — gradient handles the fade */}
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${event.photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />

      {/* Gradient: tinted at top → solid black before form content */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(
            to bottom,
            rgba(${event.tint},0.42) 0%,
            rgba(0,0,0,0.55) 20%,
            rgba(0,0,0,0.87) 36%,
            rgba(0,0,0,0.97) 48%,
            #000 58%
          )`,
        }}
      />

      {/* Scrollable content — sits above image + gradient */}
      <div
        style={{
          position: "relative", zIndex: 1,
          flex: 1, overflowY: "auto",
          paddingBottom: 100,
        }}
      >
        {/* Back button */}
        <div style={{ padding: "52px 20px 0" }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(0,0,0,0.35)",
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
        </div>

        {/* Space so the photo shows through before event info */}
        <div style={{ height: "14dvh" }} />

        {/* Event info — sits where image is still partially visible */}
        <div style={{ padding: "0 20px 28px" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 5px" }}>
            {event.trending}
          </p>
          <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.1, margin: "0 0 5px" }}>
            {event.name}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
            {event.subtitle}
          </p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
            {event.date} &middot; {event.venue.split("·")[0].trim()}
          </p>
        </div>

        {/* Form content — appears on fully opaque black */}
        <div style={{ padding: "0 20px" }}>

          {/* Quantity stepper */}
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>How many tickets?</p>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "#1C1C1E", border: "none",
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
                background: "#1C1C1E", border: "none",
                color: "#fff", fontSize: 24, fontWeight: 300,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >+</button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
              × {event.price} RLUSD ea.
            </span>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 26 }} />

          {/* Ticket slots */}
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>Who are the tickets for?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slots.map((slot, i) => (
              <div key={i} style={{ 
                background: "rgba(255,255,255,0.04)", 
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
                borderRadius: 12, 
                padding: "12px 14px" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (i === 0 && slot.forMe) ? 0 : 10 }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                    Ticket #{i + 1}
                  </p>
                  {i > 0 && (
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500 }}>
                      Guest
                    </span>
                  )}
                </div>
                {i === 0 && (
                  <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 3, marginBottom: slot.forMe ? 0 : 10, marginTop: 10 }}>
                    <button
                      onClick={() => setForMe(i, true)}
                      style={{
                        flex: 1, padding: "6px 0",
                        borderRadius: 6, border: "none",
                        background: slot.forMe ? "rgba(240,110,29,0.85)" : "transparent",
                        color: slot.forMe ? "#fff" : "rgba(255,255,255,0.5)",
                        fontSize: 13, fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >For me</button>
                    <button
                      onClick={() => setForMe(i, false)}
                      style={{
                        flex: 1, padding: "6px 0",
                        borderRadius: 6, border: "none",
                        background: !slot.forMe ? "rgba(240,110,29,0.85)" : "transparent",
                        color: !slot.forMe ? "#fff" : "rgba(255,255,255,0.5)",
                        fontSize: 13, fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >For someone else</button>
                  </div>
                )}
                {(!slot.forMe || i > 0) && (
                  <input
                    placeholder="Recipient's wallet address (r...)"
                    value={slot.wallet}
                    onChange={e => setWalletVal(i, e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
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
              background: "#1C1C1E", borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: "0 0 2px" }}>Total</p>
              <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>{total} RLUSD</p>
            </div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>{quantity} × {event.price}</p>
          </div>
        </div>
      </div>

      {/* Confirm button — fixed at bottom, outside scroll */}
      <div
        style={{
          flexShrink: 0, zIndex: 2,
          padding: "12px 20px 40px",
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
