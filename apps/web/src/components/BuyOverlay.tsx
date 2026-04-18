"use client";

import { useEffect, useState, useRef } from "react";
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

  // Drag state
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (event) {
      setQuantity(1);
      setSlots([{ forMe: true, wallet: "" }]);
      setSubmitting(false);
      setDone(false);
      setDragY(0);
      setDragging(false);
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

  const setWalletVal = (i: number, val: string) => {
    setSlots(prev => prev.map((s, idx) => 
      idx === i ? { ...s, wallet: val } : s
    ));
  };

  const handleBuy = async () => {
    setSubmitting(true);
    const recipients = slots.map(s => s.forMe ? myWallet : s.wallet.trim());
    console.log("buyGroupTicket", { venueId: event.id, payerWallet: myWallet, recipients, amountRlusd: total });
    await new Promise(r => setTimeout(r, 1600));
    setSubmitting(false);
    setDone(true);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientY - startY.current;
    if (delta > 0) {
      setDragY(delta);
    } else {
      // Small resistance when pulling up
      setDragY(delta * 0.1);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragY > 120) {
      onClose();
    }
    setDragging(false);
    setDragY(0);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (done) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        pointerEvents: visible ? "auto" : "none"
      }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", transition: "opacity 0.4s ease", opacity: visible ? 1 : 0 }} />
        
        <div style={{
          position: "relative", background: "#1C1C1E", borderTopLeftRadius: 32, borderTopRightRadius: 32,
          padding: "32px 24px 48px", transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16
        }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "rgba(48,209,88,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ color: "#FFF", fontSize: 24, fontWeight: 700, margin: 0 }}>Done</h2>
          <p style={{ color: "#8E8E93", fontSize: 16, textAlign: "center", margin: 0, maxWidth: 280 }}>
            {quantity === 1 ? "Your ticket is ready." : `${quantity} tickets are ready. Recipients will receive a claim link.`}
          </p>
          <button onClick={onClose} style={{ marginTop: 24, width: "100%", background: "#F06E1D", color: "#FFF", padding: 16, borderRadius: 16, fontSize: 17, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const transformStyle = visible ? `translateY(${dragY > 0 ? dragY : dragY}px)` : "translateY(100%)";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      pointerEvents: visible ? "auto" : "none"
    }}>
      <div 
        onClick={onClose}
        style={{ 
          position: "absolute", inset: 0, 
          background: "rgba(0,0,0,0.6)", 
          backdropFilter: "blur(4px)",
          transition: "opacity 0.4s ease",
          opacity: visible ? 1 : 0
        }} 
      />
      
      <div style={{
        position: "relative",
        background: "#1C1C1E",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: "20px 24px 40px",
        transform: transformStyle,
        transition: dragging ? "none" : "transform 0.5s cubic-bezier(0.32,0.72,0,1)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column"
      }}>
        {/* Handle stays fixed at top and is draggable */}
        <div 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ 
            width: "100%", height: 32, margin: "-20px 0 0", flexShrink: 0,
            display: "flex", justifyContent: "center", alignItems: "center",
            cursor: "grab", touchAction: "none" // Prevent native scrolling on the handle
          }}
        >
          <div style={{ width: 40, height: 5, background: dragging ? "#8E8E93" : "#48484A", borderRadius: 3, transition: "background 0.2s" }} />
        </div>
        
        {/* Everything else is inside the scrollable area */}
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: 20 }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, marginTop: 8 }}>
            <img src={event.photo} alt={event.name} style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", background: "#2C2C2E" }} />
            <div style={{ flex: 1 }}>
              <h2 style={{ color: "#FFF", fontSize: 20, fontWeight: 600, margin: "0 0 2px" }}>{event.name}</h2>
              <p style={{ color: "#8E8E93", fontSize: 15, margin: 0 }}>{event.subtitle}</p>
            </div>
            <div style={{ background: "rgba(240,110,29,0.15)", padding: "6px 12px", borderRadius: 100 }}>
              <span style={{ color: "#F06E1D", fontSize: 15, fontWeight: 700 }}>{event.price} RLUSD</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px", marginBottom: 32 }}>
            <span style={{ color: "#FFF", fontSize: 16 }}>Account</span>
            <span style={{ color: "#8E8E93", fontSize: 16 }}>{myWallet.slice(0,6)}...{myWallet.slice(-4)}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
            <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>How many tickets?</p>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "#2C2C2E", border: "none",
                  color: quantity > 1 ? "#F06E1D" : "#8E8E93", fontSize: 24, fontWeight: 300,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.2s ease"
                }}
              >−</button>
              <span style={{ color: "#fff", fontSize: 32, fontWeight: 700, minWidth: 40, textAlign: "center" }}>
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => Math.min(8, q + 1))}
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "#2C2C2E", border: "none",
                  color: quantity < 8 ? "#F06E1D" : "#8E8E93", fontSize: 24, fontWeight: 300,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.2s ease"
                }}
              >+</button>
            </div>
          </div>

          <h3 style={{ color: "#8E8E93", fontSize: 13, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", margin: "0 0 16px 4px" }}>
            Recipients
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "0 4px" }}>
            {slots.map((slot, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#FFF", fontSize: 16, fontWeight: 500 }}>Ticket {i + 1}</span>
                  {i === 0 && (
                    <div style={{ display: "flex", background: "#2C2C2E", borderRadius: 8, padding: 3 }}>
                      <button
                        onClick={() => setForMe(i, true)}
                        style={{
                          padding: "6px 16px", borderRadius: 6, border: "none",
                          background: slot.forMe ? "#F06E1D" : "transparent",
                          color: slot.forMe ? "#FFF" : "#8E8E93",
                          fontSize: 14, fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: slot.forMe ? "0 1px 3px rgba(0,0,0,0.3)" : "none"
                        }}
                      >For me</button>
                      <button
                        onClick={() => setForMe(i, false)}
                        style={{
                          padding: "6px 16px", borderRadius: 6, border: "none",
                          background: !slot.forMe ? "#F06E1D" : "transparent",
                          color: !slot.forMe ? "#FFF" : "#8E8E93",
                          fontSize: 14, fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: !slot.forMe ? "0 1px 3px rgba(0,0,0,0.3)" : "none"
                        }}
                      >Gift</button>
                    </div>
                  )}
                </div>
                
                {(!slot.forMe || i > 0) && (
                  <input
                    placeholder="Wallet address (r...)"
                    value={slot.wallet}
                    onChange={e => setWalletVal(i, e.target.value)}
                    style={{
                      width: "100%", background: "transparent", 
                      border: "none", borderBottom: "1px solid #38383A",
                      borderRadius: 0, padding: "8px 0", color: "#FFF", fontSize: 15,
                      outline: "none", boxSizing: "border-box"
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer actions fixed at bottom */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #2C2C2E", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px" }}>
            <span style={{ color: "#8E8E93", fontSize: 16 }}>Total</span>
            <span style={{ color: "#FFF", fontSize: 24, fontWeight: 700 }}>{total} RLUSD</span>
          </div>
          
          <button 
            onClick={handleBuy} 
            disabled={!canBuy || submitting}
            style={{ 
              width: "100%", 
              background: canBuy && !submitting ? "#F06E1D" : "#2C2C2E", 
              color: canBuy && !submitting ? "#FFF" : "#8E8E93", 
              padding: 16, 
              borderRadius: 16, 
              fontSize: 17, 
              fontWeight: 600, 
              border: "none",
              cursor: canBuy && !submitting ? "pointer" : "not-allowed",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              transition: "background 0.2s ease, color 0.2s ease"
            }}
          >
            {submitting ? (
              <>
                <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFF", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                Processing...
              </>
            ) : (
              `Pay ${total} RLUSD`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
