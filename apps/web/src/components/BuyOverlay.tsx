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
          <button onClick={onClose} style={{ marginTop: 24, width: "100%", background: "#2C2C2E", color: "#FFF", padding: 16, borderRadius: 16, fontSize: 17, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

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
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.5s cubic-bezier(0.32,0.72,0,1)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{ width: 40, height: 5, background: "#48484A", borderRadius: 3, margin: "0 auto 24px" }} />
        
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <img src={event.photo} alt={event.name} style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", background: "#2C2C2E" }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ color: "#FFF", fontSize: 20, fontWeight: 600, margin: "0 0 2px" }}>{event.name}</h2>
            <p style={{ color: "#8E8E93", fontSize: 15, margin: 0 }}>{event.subtitle}</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 100 }}>
            <span style={{ color: "#FFF", fontSize: 15, fontWeight: 600 }}>{event.price} RLUSD</span>
          </div>
        </div>
        
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: 20 }}>
          
          <div style={{ background: "#2C2C2E", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: "1px solid #38383A" }}>
              <span style={{ color: "#FFF", fontSize: 16 }}>Account</span>
              <span style={{ color: "#8E8E93", fontSize: 16 }}>{myWallet.slice(0,6)}...{myWallet.slice(-4)}</span>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
              <span style={{ color: "#FFF", fontSize: 16 }}>Tickets</span>
              <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#1C1C1E", borderRadius: 8, padding: "4px 8px" }}>
                <button 
                  onClick={() => setQuantity(q => Math.max(1, q - 1))} 
                  style={{ width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", color: quantity > 1 ? "#0A84FF" : "#48484A", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >−</button>
                <span style={{ color: "#FFF", fontSize: 16, fontWeight: 600, width: 20, textAlign: "center" }}>{quantity}</span>
                <button 
                  onClick={() => setQuantity(q => Math.min(8, q + 1))} 
                  style={{ width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", color: quantity < 8 ? "#0A84FF" : "#48484A", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >+</button>
              </div>
            </div>
          </div>

          <h3 style={{ color: "#8E8E93", fontSize: 13, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", margin: "0 0 8px 16px" }}>
            Recipients
          </h3>
          
          <div style={{ background: "#2C2C2E", borderRadius: 16, overflow: "hidden" }}>
            {slots.map((slot, i) => (
              <div key={i} style={{ padding: 16, borderBottom: i < slots.length - 1 ? "1px solid #38383A" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (i === 0 && slot.forMe) ? 0 : 12 }}>
                  <span style={{ color: "#FFF", fontSize: 16, fontWeight: 500 }}>Ticket {i + 1}</span>
                  {i === 0 && (
                    <div style={{ display: "flex", background: "#1C1C1E", borderRadius: 8, padding: 3 }}>
                      <button
                        onClick={() => setForMe(i, true)}
                        style={{
                          padding: "4px 12px", borderRadius: 6, border: "none",
                          background: slot.forMe ? "#48484A" : "transparent",
                          color: slot.forMe ? "#FFF" : "#8E8E93",
                          fontSize: 13, fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >Me</button>
                      <button
                        onClick={() => setForMe(i, false)}
                        style={{
                          padding: "4px 12px", borderRadius: 6, border: "none",
                          background: !slot.forMe ? "#48484A" : "transparent",
                          color: !slot.forMe ? "#FFF" : "#8E8E93",
                          fontSize: 13, fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >Gift</button>
                    </div>
                  )}
                  {i > 0 && (
                    <span style={{ color: "#8E8E93", fontSize: 14 }}>Guest</span>
                  )}
                </div>
                
                {(!slot.forMe || i > 0) && (
                  <input
                    placeholder="Wallet address (r...)"
                    value={slot.wallet}
                    onChange={e => setWalletVal(i, e.target.value)}
                    style={{
                      width: "100%", background: "#1C1C1E", border: "1px solid #38383A",
                      borderRadius: 10, padding: "12px 16px", color: "#FFF", fontSize: 15,
                      outline: "none", boxSizing: "border-box"
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "0 4px" }}>
            <span style={{ color: "#8E8E93", fontSize: 16 }}>Total</span>
            <span style={{ color: "#FFF", fontSize: 24, fontWeight: 700 }}>{total} RLUSD</span>
          </div>
          
          <button 
            onClick={handleBuy} 
            disabled={!canBuy || submitting}
            style={{ 
              width: "100%", 
              background: canBuy && !submitting ? "#0A84FF" : "#2C2C2E", 
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
