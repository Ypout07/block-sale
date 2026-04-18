"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useProtocol } from "@/hooks/useProtocol";
import { ALL_EVENTS, type Event } from "@/data/events";

// ── Nav icons ─────────────────────────────────────────────────────────────────

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 4l9 8" />
      <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
    </svg>
  );
}

function IconTicketNav({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a1 1 0 011-1h.5a1.5 1.5 0 000-3H3a1 1 0 01-1-1V5a2 2 0 012-2h14a2 2 0 012 2v1a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3H20a1 1 0 011 1v1a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3H20a1 1 0 011 1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1 1 0 011-1h.5a1.5 1.5 0 000-3H3a1 1 0 01-1-1V9z" />
    </svg>
  );
}

function IconList({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2.5" />
      <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2.5" />
      <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2.5" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ClaimStatus = "pending_authorization" | "claimed";
type ClaimPhase = "preview" | "claiming" | "success";

type IncomingTicket = {
  claimId: string;
  event: Event;
  buyerAddress: string;
  amountRlusd: string;
  seatInfo: string;
  status: ClaimStatus;
  createdAt: string;
  txHash: string;
  issuanceId: string;
  claimedAt?: string;
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const byId = (id: string) => ALL_EVENTS.find((e) => e.id === id)!;

const INITIAL_CLAIMS: IncomingTicket[] = [
  {
    claimId: "claim_001",
    event: byId("13"), // Tyler, the Creator
    buyerAddress: "rAlice7Kp3NmXqwZbDtF9sV2Yj8LcRe31",
    amountRlusd: "115",
    seatInfo: "Floor GA · Ticket #4421",
    status: "pending_authorization",
    createdAt: "2026-04-16T14:23:00Z",
    txHash: "A3F2B91C4DE7089F3A2B561CE8D4F90A7B3E2C1D5F6A0B8E4C7D9F2A1B3C5E8",
    issuanceId: "00130000F06E1D00000D",
  },
  {
    claimId: "claim_002",
    event: byId("10"), // Beyoncé
    buyerAddress: "rBob8Mq4OnYrXaEwCuGt7Pk5Nb2Vh6Li1",
    amountRlusd: "250",
    seatInfo: "Section B · Row 3 · Seat 7",
    status: "pending_authorization",
    createdAt: "2026-04-15T09:11:00Z",
    txHash: "D7C4E82B1F3A90E456BC2D87F1A3E45C8B7D2F9A0E3C6B1D4F7A2E5C8B0D3F6",
    issuanceId: "00130000F06E1D00000A",
  },
  {
    claimId: "claim_003",
    event: byId("6"), // Olivia Rodrigo
    buyerAddress: "rCarol2Jd5PsWnYvBrFk9Tq7Xm3Ue8Og2",
    amountRlusd: "75",
    seatInfo: "Section D · Row 8 · Seat 14",
    status: "claimed",
    createdAt: "2026-03-20T16:45:00Z",
    txHash: "F1A3C56D9B2E8074A5F3C1E78D2B4F9A6C3E0B5D7F1A4C8E2B6D0F3A7C1E9B4",
    issuanceId: "00130000F06E1D000006",
    claimedAt: "2026-03-20T16:47:23Z",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncAddr(addr: string) {
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function truncHash(hash: string) {
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Claim Overlay ─────────────────────────────────────────────────────────────

function ClaimOverlay({
  ticket,
  visible,
  onClose,
  onClaimed,
}: {
  ticket: IncomingTicket | null;
  visible: boolean;
  onClose: () => void;
  onClaimed: (claimId: string) => void;
}) {
  const router = useRouter();
  const { claim } = useProtocol();
  const [phase, setPhase] = useState<ClaimPhase>("preview");
  const [slideIn, setSlideIn] = useState(false);
  const [checkDraw, setCheckDraw] = useState(false);
  const [detailsIn, setDetailsIn] = useState(false);
  const [claimError, setClaimError] = useState("");

  // Animate in when opened
  useEffect(() => {
    if (visible && ticket) {
      setPhase("preview");
      setCheckDraw(false);
      setDetailsIn(false);
      setSlideIn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(true)));
    } else {
      setSlideIn(false);
    }
  }, [visible, ticket?.claimId]);

  // Draw checkmark then reveal details after success
  useEffect(() => {
    if (phase === "success") {
      requestAnimationFrame(() => requestAnimationFrame(() => setCheckDraw(true)));
      setTimeout(() => setDetailsIn(true), 700);
    }
  }, [phase]);

  async function handleClaim() {
    if (!ticket || phase !== "preview") return;
    setClaimError("");
    setPhase("claiming");
    try {
      await claim(ticket.claimId);
      setPhase("success");
      onClaimed(ticket.claimId);
    } catch (e: unknown) {
      setClaimError(e instanceof Error ? e.message : "Claim failed.");
      setPhase("preview");
    }
  }

  if (!ticket) return null;

  const isSuccess = phase === "success";
  const canClose = phase === "preview" || phase === "success";

  const btnSize = isSuccess ? 64 : 112;
  const btnAnim = phase === "preview"
    ? "claimPulse 2s infinite"
    : phase === "claiming"
    ? "claimPulseFast 0.65s infinite"
    : "none";

  return (
    <div className="fixed inset-0 z-50 max-w-md mx-auto" style={{ pointerEvents: visible ? "auto" : "none" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(10px)",
          opacity: slideIn ? 1 : 0,
          transition: "opacity 0.3s",
        }}
        onClick={() => canClose && onClose()}
      />

      {/* Card — slides up, then expands to full screen on success */}
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{
          top: isSuccess ? 0 : "38vh",
          bottom: 0,
          borderRadius: isSuccess ? "0" : "24px 24px 0 0",
          transform: `translateY(${slideIn ? "0%" : "100%"})`,
          transition: [
            "transform 0.45s cubic-bezier(0.32,0.72,0,1)",
            "top 0.55s cubic-bezier(0.32,0.72,0,1)",
            "border-radius 0.55s cubic-bezier(0.32,0.72,0,1)",
          ].join(", "),
          backgroundImage: `url(${ticket.event.photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div
          style={{
            background: `linear-gradient(to bottom, rgba(${ticket.event.tint},0.58) 0%, rgba(${ticket.event.tint},0.22) 35%, rgba(0,0,0,0.68) 65%, rgba(0,0,0,0.96) 100%)`,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Drag handle (preview only) */}
          {!isSuccess && (
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.22)" }} />
            </div>
          )}

          {/* Event header */}
          <div
            className="flex-shrink-0 px-6"
            style={{ paddingTop: isSuccess ? 64 : 16, paddingBottom: 12, transition: "padding-top 0.5s" }}
          >
            {isSuccess && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.9)" }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "rgba(34,197,94,0.9)" }}>
                  Ticket Claimed
                </span>
              </div>
            )}
            <h2
              className="text-white font-bold leading-tight tracking-tight drop-shadow-lg"
              style={{ fontSize: isSuccess ? 32 : 26, transition: "font-size 0.5s" }}
            >
              {ticket.event.name}
            </h2>
            <p
              className="font-semibold mt-1 drop-shadow"
              style={{ fontSize: isSuccess ? 17 : 15, color: "rgba(255,255,255,0.82)", transition: "font-size 0.5s" }}
            >
              {ticket.event.subtitle}
            </p>
            <p className="text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              {ticket.event.date} · {ticket.event.venue.split("·")[0].trim()}
            </p>
          </div>

          {/* Claim button area — vertically centered in remaining space */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleClaim}
                disabled={phase !== "preview"}
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: btnSize,
                  height: btnSize,
                  background: "rgba(34,197,94,1)",
                  transition: "width 0.4s cubic-bezier(0.32,0.72,0,1), height 0.4s cubic-bezier(0.32,0.72,0,1)",
                  animation: btnAnim,
                  cursor: phase === "preview" ? "pointer" : "default",
                }}
              >
                {isSuccess ? (
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <path
                      d="M5 13L10.5 19L21 7"
                      stroke="white"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="25"
                      strokeDashoffset={checkDraw ? 0 : 25}
                      style={{ transition: "stroke-dashoffset 0.45s ease-out 0.1s" }}
                    />
                  </svg>
                ) : phase === "claiming" ? (
                  <div
                    className="rounded-full border-[3px] border-white border-t-transparent animate-spin"
                    style={{ width: 34, height: 34 }}
                  />
                ) : (
                  <span className="text-white font-bold text-[18px] select-none">Claim</span>
                )}
              </button>

              <p
                className="text-[12px] text-center"
                style={{
                  color: "rgba(255,255,255,0.45)",
                  opacity: isSuccess ? 0 : 1,
                  transition: "opacity 0.3s",
                }}
              >
                {phase === "claiming" ? "Authorizing on XRPL…" : "Tap to accept this gift"}
              </p>
            </div>
          </div>

          {/* Bottom strip */}
          <div
            className="flex-shrink-0"
            style={{
              background: "rgba(0,0,0,0.62)",
              backdropFilter: "blur(14px)",
              padding: "16px 20px",
              paddingBottom: isSuccess ? 36 : 20,
              transition: "padding-bottom 0.5s",
            }}
          >
            {isSuccess && detailsIn ? (
              /* Success details */
              <div
                style={{ opacity: detailsIn ? 1 : 0, transition: "opacity 0.4s" }}
                className="flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Seat</span>
                  <span className="text-[13px] font-semibold text-white">{ticket.seatInfo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Gift from</span>
                  <span className="text-[12px] font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {truncAddr(ticket.buyerAddress)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Tx Hash</span>
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {truncHash(ticket.txHash)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Issuance ID</span>
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {ticket.issuanceId}
                  </span>
                </div>
                <button
                  onClick={() => { onClose(); router.push("/tickets"); }}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px]"
                  style={{ background: "#F06E1D" }}
                >
                  View My Tickets
                </button>
              </div>
            ) : !isSuccess ? (
              /* Preview / Claiming — gift info */
              <div>
                {claimError && (
                  <p className="text-[12px] mb-2 text-center" style={{ color: "#c0392b" }}>{claimError}</p>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-[13px] font-semibold leading-tight">Gift from</p>
                    <p className="text-[11px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {truncAddr(ticket.buyerAddress)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-[13px] font-semibold">{ticket.amountRlusd} RLUSD</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {ticket.seatInfo}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Claim Row ─────────────────────────────────────────────────────────────────

function ClaimRow({
  ticket,
  onTap,
}: {
  ticket: IncomingTicket;
  onTap?: () => void;
}) {
  const isPending = ticket.status === "pending_authorization";

  return (
    <button
      onClick={isPending ? onTap : undefined}
      className="w-full flex items-center gap-3 px-4 py-4 text-left"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        opacity: isPending ? 1 : 0.45,
        cursor: isPending ? "pointer" : "default",
      }}
    >
      {/* Thumbnail */}
      <div
        className="rounded-xl flex-shrink-0"
        style={{
          width: 48,
          height: 48,
          backgroundImage: `url(${ticket.event.photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-[15px] font-semibold leading-tight truncate">
          {ticket.event.name}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
          {ticket.event.date}
        </p>
        <p className="text-[11px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.28)" }}>
          {truncAddr(ticket.buyerAddress)} · {ticket.amountRlusd} RLUSD
        </p>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const { walletAddress, getClaims } = useProtocol();
  const [claims, setClaims] = useState<IncomingTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    async function fetchClaims() {
      if (!walletAddress) {
        setLoading(false);
        return;
      }
      try {
        const rawClaims = await getClaims();
        const formatted = rawClaims.map((c: any) => ({
          claimId: c.claimId,
          event: byId(c.venueId) || byId("13"), // fallback to Tyler if ID mismatch
          buyerAddress: c.buyerAddress,
          amountRlusd: c.amountRlusd,
          seatInfo: "General Admission",
          status: c.status,
          createdAt: c.createdAt,
          txHash: "XRPL_HASH_PENDING",
          issuanceId: c.issuanceId,
        }));
        setClaims(formatted);
      } catch (e) {
        console.error("Failed to fetch claims", e);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, [walletAddress, getClaims]);

  const pending = claims.filter((c) => c.status === "pending_authorization");
  const past = claims.filter((c) => c.status === "claimed");

  function openClaim(claimId: string) {
    setSelectedId(claimId);
    requestAnimationFrame(() => requestAnimationFrame(() => setOverlayVisible(true)));
  }

  function closeClaim() {
    setOverlayVisible(false);
    setTimeout(() => setSelectedId(null), 520);
  }

  function handleClaimed(claimId: string) {
    setClaims((prev) =>
      prev.map((c) =>
        c.claimId === claimId
          ? { ...c, status: "claimed" as ClaimStatus, claimedAt: new Date().toISOString() }
          : c
      )
    );
  }

  const selectedTicket = claims.find((c) => c.claimId === selectedId) ?? null;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24" style={{ background: "#000" }}>
      {/* Header Spacer */}
      <div className="pt-14" />

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#F06E1D] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Pending section */}
      {!loading && pending.length > 0 && (
        <div className="mt-2">
          <div className="px-4 mb-4">
            <h2 className="text-[22px] font-bold text-white tracking-tight uppercase">
              Pending
            </h2>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {pending.map((ticket) => (
              <ClaimRow key={ticket.claimId} ticket={ticket} onTap={() => openClaim(ticket.claimId)} />
            ))}
          </div>
        </div>
      )}

      {/* Past claims section */}
      {!loading && past.length > 0 && (
        <div className="mt-8">
          <div className="px-4 mb-4">
            <h2 className="text-[22px] font-bold text-white tracking-tight uppercase">
              Claimed
            </h2>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {past.map((ticket) => (
              <ClaimRow key={ticket.claimId} ticket={ticket} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && claims.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 px-8">
          <p className="text-[18px] font-semibold text-white text-center">No incoming tickets</p>
          <p className="text-[14px] mt-2 text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
            When someone gifts you a ticket it will appear here.
          </p>
        </div>
      )}

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-center justify-around px-8 pt-3 pb-7"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Link href="/" className="flex flex-col items-center gap-1">
          <IconHome />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Home</span>
        </Link>
        <Link href="/tickets" className="flex flex-col items-center gap-1">
          <IconTicketNav />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>My Tickets</span>
        </Link>
        <Link href="/claim" className="flex flex-col items-center gap-1">
          <IconList active />
          <span className="text-[10px] font-semibold" style={{ color: "#F06E1D" }}>Activity</span>
        </Link>
      </nav>

      <ClaimOverlay
        ticket={selectedTicket}
        visible={overlayVisible}
        onClose={closeClaim}
        onClaimed={handleClaimed}
      />
    </div>
  );
}
