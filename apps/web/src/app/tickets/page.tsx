"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ALL_EVENTS, type Event } from "@/data/events";

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

type TicketStatus = "active" | "returned";

type PurchasedTicket = {
  id: string;
  event: Event;
  purchasedAt: Date;
  eventDateTime: Date;
  quantity: number;
  seatInfo: string;
  status: TicketStatus;
  returnedAt?: Date;
};

const byId = (id: string) => ALL_EVENTS.find((e) => e.id === id)!;

const INITIAL_TICKETS: PurchasedTicket[] = [
  // Ready for Entry — event tonight, within 24h window
  {
    id: "t2",
    event: byId("2"), // Coldplay
    purchasedAt: new Date("2026-04-10"),
    eventDateTime: new Date("2026-04-18T23:00:00"),
    quantity: 2,
    seatInfo: "Floor GA · Tickets #3341–3342",
    status: "active",
  },
  // Returnable — event May 23, well outside 24h
  {
    id: "t1",
    event: byId("1"), // The 1975
    purchasedAt: new Date("2026-04-16"),
    eventDateTime: new Date("2026-05-23T19:00:00"),
    quantity: 2,
    seatInfo: "Section A · Row 12 · Seats 14–15",
    status: "active",
  },
  // Returned
  {
    id: "t3",
    event: byId("4"), // Bad Bunny
    purchasedAt: new Date("2026-01-05"),
    eventDateTime: new Date("2026-07-02T20:00:00"),
    quantity: 2,
    seatInfo: "Section E · Row 6 · Seats 10–11",
    status: "returned",
    returnedAt: new Date("2026-01-20"),
  },
  // Returned
  {
    id: "t4",
    event: byId("8"), // SZA
    purchasedAt: new Date("2026-03-28"),
    eventDateTime: new Date("2026-09-05T20:00:00"),
    quantity: 1,
    seatInfo: "Section B · Row 8 · Seat 22",
    status: "returned",
    returnedAt: new Date("2026-04-02"),
  },
];

function fmt(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function hoursUntil(dt: Date) {
  return (dt.getTime() - Date.now()) / 3_600_000;
}

function isReadyForEntry(t: PurchasedTicket) {
  const h = hoursUntil(t.eventDateTime);
  return t.status === "active" && h > 0 && h <= 24;
}

// ── QR Modal ─────────────────────────────────────────────────────────────────

const QR_TTL = 90;
const RING_R = 30;
const RING_CIRC = 2 * Math.PI * RING_R;

function makeQrValue(ticket: PurchasedTicket): string {
  const now = new Date();
  const nonce = Math.random().toString(16).slice(2, 10);
  return JSON.stringify({
    schemaVersion: 1,
    purpose: "ticket-redemption",
    ticketId: `txhash_${ticket.id}:rWalletDemo1234:0`,
    wallet: "rN7n3473SaZBCG4dFL83w7PB5yBFGT1234",
    venueId: "rVenuePoolKC2026xGt9",
    issuanceId: "00130000F06E" + ticket.id.toUpperCase(),
    didProvider: "mock-phone-proof",
    didToken: "zkp-mock-" + nonce,
    nonce,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + QR_TTL * 1000).toISOString(),
    qrHash: "sha256_mock_" + nonce,
  });
}

function QrModal({
  ticket,
  visible,
  onClose,
}: {
  ticket: PurchasedTicket | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const [qrValue, setQrValue] = useState("");
  const [slideY, setSlideY] = useState("100%");

  // Animate in/out and seed QR on open
  useEffect(() => {
    if (visible && ticket) {
      setQrValue(makeQrValue(ticket));
      setSecondsLeft(QR_TTL);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideY("0%")));
    } else {
      setSlideY("100%");
    }
  }, [visible, ticket?.id]);

  // Countdown tick
  useEffect(() => {
    if (!visible || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [visible, secondsLeft]);

  function handleRefresh() {
    if (!ticket) return;
    setQrValue(makeQrValue(ticket));
    setSecondsLeft(QR_TTL);
  }

  if (!ticket) return null;

  const qrExpired = secondsLeft <= 0;
  const dashOffset = RING_CIRC * (1 - Math.max(0, secondsLeft) / QR_TTL);
  const ringColor = secondsLeft > 20 ? "#F06E1D" : "#c0392b";

  return (
    <div
      className="fixed inset-0 z-50 max-w-md mx-auto"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl"
        style={{
          background: "#0D0D0D",
          transform: `translateY(${slideY})`,
          transition: "transform 0.45s cubic-bezier(0.32,0.72,0,1)",
          paddingBottom: "32px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "#F06E1D" }}>
            Ready for Entry
          </p>
          <h2 className="text-white text-[26px] font-bold leading-tight tracking-tight">
            {ticket.event.name}
          </h2>
          <p className="text-[14px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {ticket.event.date}
          </p>
          <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            {ticket.event.venue.split("·")[0].trim()} · {ticket.seatInfo}
          </p>
        </div>

        {/* QR code */}
        <div className="flex justify-center px-6">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "#fff",
              filter: qrExpired ? "grayscale(1) opacity(0.3)" : "none",
              transition: "filter 0.5s",
            }}
          >
            <QRCodeSVG value={qrValue || " "} size={220} level="M" />
          </div>
        </div>

        {/* Timer / Refresh */}
        <div className="flex justify-center items-center mt-6 mb-5" style={{ minHeight: "72px" }}>
          {qrExpired ? (
            <button
              onClick={handleRefresh}
              className="text-white text-[15px] font-bold px-10 py-3 rounded-2xl"
              style={{ background: "#F06E1D" }}
            >
              Refresh QR
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={RING_R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5" />
                <circle
                  cx="36" cy="36" r={RING_R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={dashOffset}
                  style={{
                    transform: "rotate(-90deg)",
                    transformOrigin: "36px 36px",
                    transition: "stroke-dashoffset 1s linear, stroke 0.5s",
                  }}
                />
                <text
                  x="36" y="37"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="-apple-system, sans-serif"
                >
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </text>
              </svg>
              <div>
                <p className="text-white text-[14px] font-semibold">QR valid for</p>
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {secondsLeft}s · auto-expires
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Close */}
        <div className="px-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-[15px] font-semibold"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  onReturnClick,
  onQrClick,
}: {
  ticket: PurchasedTicket;
  onReturnClick: (id: string) => void;
  onQrClick: (id: string) => void;
}) {
  const h = hoursUntil(ticket.eventDateTime);
  const ready = isReadyForEntry(ticket);
  const isReturned = ticket.status === "returned";
  const canReturn = !isReturned && h > 24;
  const isPast = !isReturned && h <= 0;
  const isGrey = isReturned || isPast;

  const expireDate = new Date(ticket.eventDateTime.getTime() - 24 * 3_600_000);

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        backgroundImage: `url(${ticket.event.photo})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        filter: isGrey ? "grayscale(1) brightness(0.55)" : "none",
        transition: "filter 0.35s",
      }}
    >
      <div
        style={{
          background: `linear-gradient(to bottom, rgba(${ticket.event.tint},0.62) 0%, rgba(${ticket.event.tint},0.28) 40%, rgba(0,0,0,0.60) 70%, rgba(0,0,0,0.90) 100%)`,
        }}
      >
        {/* 380px body */}
        <div className="flex flex-col justify-between p-5" style={{ height: "380px" }}>
          {/* Top: badge + quantity */}
          <div className="flex items-center justify-between">
            {isReturned ? (
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}>
                Returned
              </span>
            ) : isPast ? (
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}>
                Past Event
              </span>
            ) : ready ? (
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: "rgba(240,110,29,0.25)", color: "#F06E1D" }}>
                Ready for Entry
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: "rgba(240,110,29,0.2)", color: "#F06E1D" }}>
                Active
              </span>
            )}
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {ticket.quantity} {ticket.quantity === 1 ? "ticket" : "tickets"}
            </span>
          </div>

          {/* Bottom: event details */}
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.60)" }}>
              {ticket.seatInfo}
            </p>
            <h2 className="text-white text-[30px] font-bold leading-tight tracking-tight drop-shadow-lg">
              {ticket.event.name}
            </h2>
            <p className="text-white font-bold text-[17px] leading-tight mt-1 drop-shadow">
              {ticket.event.subtitle}
            </p>
            <p className="text-[14px] mt-2 leading-snug" style={{ color: "rgba(255,255,255,0.65)" }}>
              {ticket.event.date}
            </p>
            <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              {ticket.event.venue.split("·")[0].trim()}
            </p>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}
        >
          <div>
            <p className="text-white text-[13px] font-semibold leading-tight">
              Purchased {fmt(ticket.purchasedAt)}
            </p>
            {isReturned && ticket.returnedAt && (
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>
                Returned {fmt(ticket.returnedAt)}
              </p>
            )}
            {isPast && (
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>
                Expired {fmt(expireDate)}
              </p>
            )}
          </div>

          {ready ? (
            <button
              onClick={() => onQrClick(ticket.id)}
              className="text-white text-[13px] font-bold px-4 py-1.5 rounded-full"
              style={{ background: "#F06E1D" }}
            >
              Get QR Code
            </button>
          ) : canReturn ? (
            <button
              onClick={() => onReturnClick(ticket.id)}
              className="text-white text-[13px] font-bold px-4 py-1.5 rounded-full"
              style={{ background: "rgba(192,57,43,0.9)" }}
            >
              Return
            </button>
          ) : (
            <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.28)" }}>
              {isReturned ? "Returned" : "Expired"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Confirm Return Modal ──────────────────────────────────────────────────────

function ConfirmReturnModal({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6"
        style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(192,57,43,0.14)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
            </svg>
          </div>
        </div>
        <h2 className="text-white text-[20px] font-bold text-center leading-snug">Return this ticket?</h2>
        <p className="text-[14px] mt-2.5 text-center leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
          This action is final and cannot be undone. Your ticket will be marked as returned and funds will be credited back to your wallet.
        </p>
        <div className="flex flex-col gap-3 mt-7">
          <button onClick={onConfirm} className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold" style={{ background: "#c0392b" }}>
            Yes, Return Ticket
          </button>
          <button onClick={onCancel} className="w-full py-3.5 rounded-2xl text-[15px] font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  tickets,
  onReturnClick,
  onQrClick,
}: {
  title: string;
  tickets: PurchasedTicket[];
  onReturnClick: (id: string) => void;
  onQrClick: (id: string) => void;
}) {
  if (tickets.length === 0) return null;

  return (
    <div className="mb-8 relative">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-[20px] font-bold text-white tracking-tight">{title}</h2>
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
          {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
        </span>
      </div>
      <div
        className="flex gap-4 hide-scrollbar"
        style={{
          overflowX: "auto",
          paddingLeft: "16px",
          scrollPaddingLeft: "16px",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tickets.map((ticket) => (
          <div key={ticket.id} style={{ width: "min(calc(100vw - 48px), 360px)", flexShrink: 0, scrollSnapAlign: "start" }}>
            <TicketCard ticket={ticket} onReturnClick={onReturnClick} onQrClick={onQrClick} />
          </div>
        ))}
        <div style={{ minWidth: "16px", flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [tickets, setTickets] = useState<PurchasedTicket[]>(INITIAL_TICKETS);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [qrTicketId, setQrTicketId] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 3_600_000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3_600_000);

  const readyTickets = tickets.filter(isReadyForEntry);
  const restTickets = tickets.filter((t) => !isReadyForEntry(t));

  const lastWeek = restTickets.filter((t) => t.purchasedAt >= sevenDaysAgo);
  const lastMonth = restTickets.filter((t) => t.purchasedAt >= thirtyDaysAgo && t.purchasedAt < sevenDaysAgo);
  const anytime = restTickets.filter((t) => t.purchasedAt < thirtyDaysAgo);

  function handleConfirm() {
    if (!confirmId) return;
    setTickets((prev) => prev.map((t) => t.id === confirmId ? { ...t, status: "returned" as TicketStatus, returnedAt: new Date() } : t));
    setConfirmId(null);
  }

  function openQr(id: string) {
    setQrTicketId(id);
    requestAnimationFrame(() => requestAnimationFrame(() => setQrVisible(true)));
  }

  function closeQr() {
    setQrVisible(false);
    setTimeout(() => setQrTicketId(null), 500);
  }

  const qrTicket = tickets.find((t) => t.id === qrTicketId) ?? null;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto pb-24" style={{ background: "#000" }}>
      <div className="pt-10 pb-6 px-4">
        <h1 className="text-[22px] font-bold text-white tracking-tight uppercase mb-2">My Tickets</h1>
        <div className="h-1 w-40 rounded-full" style={{ background: "#F06E1D" }}></div>
      </div>

      <div className="pt-2">
        <Section title="Ready for Entry" tickets={readyTickets} onReturnClick={setConfirmId} onQrClick={openQr} />
        <Section title="Recent Purchases" tickets={lastWeek} onReturnClick={setConfirmId} onQrClick={openQr} />
        <Section title="Last 30 Days" tickets={lastMonth} onReturnClick={setConfirmId} onQrClick={openQr} />
        <Section title="Older Tickets" tickets={anytime} onReturnClick={setConfirmId} onQrClick={openQr} />
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-center justify-around px-8 pt-3 pb-7"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Link href="/" className="flex flex-col items-center gap-1">
          <IconHome />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Home</span>
        </Link>
        <Link href="/tickets" className="flex flex-col items-center gap-1">
          <IconTicketNav active />
          <span className="text-[10px] font-semibold" style={{ color: "#F06E1D" }}>My Tickets</span>
        </Link>
        <Link href="/claim" className="flex flex-col items-center gap-1">
          <IconList />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Activity</span>
        </Link>
      </nav>

      <ConfirmReturnModal visible={confirmId !== null} onConfirm={handleConfirm} onCancel={() => setConfirmId(null)} />
      <QrModal ticket={qrTicket} visible={qrVisible} onClose={closeQr} />
    </div>
  );
}
