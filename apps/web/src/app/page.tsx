"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { ALL_EVENTS, type Event } from "@/data/events";
import { BuyOverlay } from "@/components/BuyOverlay";

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

function EventCardInner({ event, onBuy }: { event: Event; onBuy: () => void }) {
  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        backgroundImage: `url(${event.photo})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }}
    >
      <div style={{ background: `linear-gradient(to bottom, rgba(${event.tint},0.62) 0%, rgba(${event.tint},0.28) 40%, rgba(0,0,0,0.60) 70%, rgba(0,0,0,0.90) 100%)` }}>
        <div className="flex flex-col justify-between p-5" style={{ height: "380px" }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>
            {event.label}
          </span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.60)" }}>
              {event.trending}
            </p>
            <h2 className="text-white text-[30px] font-bold leading-tight tracking-tight drop-shadow-lg">
              {event.name}
            </h2>
            <p className="text-white font-bold text-[17px] leading-tight mt-1 drop-shadow">
              {event.subtitle}
            </p>
            <p className="text-[14px] mt-2 leading-snug" style={{ color: "rgba(255,255,255,0.65)" }}>
              {event.description}
            </p>
          </div>
        </div>

        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}
        >
          <div>
            <p className="text-white text-[13px] font-semibold leading-tight">
              {event.venue.split("·")[0].trim()}
            </p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>{event.date}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>From {event.price} RLUSD</span>
            <button
              onClick={onBuy}
              className="text-white text-[13px] font-bold px-4 py-1.5 rounded-full"
              style={{ background: "#F06E1D" }}
            >
              Buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventSection({ label, events, onBuy }: { label: string; events: Event[]; onBuy: (e: Event) => void }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between px-4 mb-3">
        <h2 className="text-[22px] font-bold text-white tracking-tight">{label}</h2>
        <button className="text-accent text-[15px] font-medium">See All</button>
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
        {events.map((event) => (
          <div
            key={event.id}
            style={{ width: "min(calc(100vw - 48px), 360px)", flexShrink: 0, scrollSnapAlign: "start" }}
          >
            <EventCardInner event={event} onBuy={() => onBuy(event)} />
          </div>
        ))}
        {/* Right-edge spacer so the last card doesn't flush against the viewport */}
        <div style={{ minWidth: "16px", flexShrink: 0 }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [overlayEvent, setOverlayEvent] = useState<Event | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const openBuy = useCallback((event: Event) => {
    setOverlayEvent(event);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOverlayVisible(true));
    });
  }, []);

  const closeBuy = useCallback(() => {
    setOverlayVisible(false);
    setTimeout(() => setOverlayEvent(null), 540);
  }, []);

  // Group events by label, preserving insertion order
  const groups = new Map<string, Event[]>();
  for (const event of ALL_EVENTS) {
    const bucket = groups.get(event.label) ?? [];
    bucket.push(event);
    groups.set(event.label, bucket);
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto pb-24" style={{ background: "#000" }}>
      <div className="flex flex-col pt-4">
        {Array.from(groups.entries()).map(([label, events]) => (
          <EventSection key={label} label={label} events={events} onBuy={openBuy} />
        ))}
      </div>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-center justify-around px-8 pt-3 pb-7"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Link href="/" className="flex flex-col items-center gap-1">
          <IconHome active />
          <span className="text-[10px] text-accent font-semibold">Home</span>
        </Link>
        <Link href="/tickets" className="flex flex-col items-center gap-1">
          <IconTicketNav />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>My Tickets</span>
        </Link>
        <Link href="/claim" className="flex flex-col items-center gap-1">
          <IconList />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Activity</span>
        </Link>
      </nav>

      <BuyOverlay event={overlayEvent} visible={overlayVisible} onClose={closeBuy} />
    </div>
  );
}
