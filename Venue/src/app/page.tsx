"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_EVENTS, type Event } from "@/data/events";

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 4l9 8" />
      <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
    </svg>
  );
}

function IconCamera({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  );
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}

function EventCardInner({ event, onScan }: { event: Event; onScan: () => void }) {
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
              Select this event to initialize the scanner for door entry.
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
            <button
              onClick={onScan}
              className="text-white text-[13px] font-bold px-5 py-1.5 rounded-full"
              style={{ background: "#F06E1D" }}
            >
              Start Scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventSection({ label, events, onScan }: { label: string; events: Event[]; onScan: (e: Event) => void }) {
  const id = `section-${label.replace(/\s+/g, '-')}`;
  return (
    <div id={id} className="mb-8 relative" style={{ scrollMarginTop: "100px" }}>
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-[20px] font-bold text-white tracking-tight">{label}</h2>
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
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
        {events.map((event) => (
          <div
            key={event.id}
            style={{ width: "min(calc(100vw - 48px), 360px)", flexShrink: 0, scrollSnapAlign: "start" }}
          >
            <EventCardInner event={event} onScan={() => onScan(event)} />
          </div>
        ))}
        <div style={{ minWidth: "16px", flexShrink: 0 }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  const handleScan = (event: Event) => {
    router.push(`/scan?venue=${event.id}`);
  };

  const groups = new Map<string, Event[]>();
  for (const event of ALL_EVENTS) {
    const bucket = groups.get(event.label) ?? [];
    bucket.push(event);
    groups.set(event.label, bucket);
  }

  const labels = Array.from(groups.keys());
  const [activeTab, setActiveTab] = useState<string>(labels[0] || "");

  const handleTabClick = (label: string) => {
    setActiveTab(label);
    const el = document.getElementById(`section-${label.replace(/\s+/g, '-')}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto pb-24" style={{ background: "#000" }}>
      <div className="sticky top-0 z-40 pt-14 pb-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="flex gap-6 overflow-x-auto hide-scrollbar px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {labels.map((label) => {
            const isActive = activeTab === label;
            return (
              <button
                key={label}
                onClick={() => handleTabClick(label)}
                className="flex flex-col items-start gap-1.5 flex-shrink-0"
              >
                <span className={`text-[13px] font-bold tracking-wider uppercase ${isActive ? 'text-white' : 'text-[#8E8E93]'}`}>
                  {label}
                </span>
                <div 
                  className="h-1 w-full rounded-full transition-colors duration-200" 
                  style={{ background: isActive ? "#F06E1D" : "rgba(255,255,255,0.15)" }} 
                />
              </button>
            );
          })}
          <div style={{ minWidth: "16px", flexShrink: 0 }} />
        </div>
      </div>

      <div className="flex flex-col pt-2">
        {Array.from(groups.entries()).map(([label, events]) => (
          <EventSection key={label} label={label} events={events} onScan={handleScan} />
        ))}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-center justify-around px-8 pt-3 pb-7"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Link href="/" className="flex flex-col items-center gap-1">
          <IconHome active />
          <span className="text-[10px] text-accent font-semibold" style={{ color: "#F06E1D" }}>Venue</span>
        </Link>
        <div className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
          <IconCamera />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Scan</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
          <IconSettings />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Settings</span>
        </div>
      </nav>
    </div>
  );
}
