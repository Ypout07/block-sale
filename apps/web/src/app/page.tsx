"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from "react";
import { ALL_EVENTS, type Event } from "@/data/events";
import { BuyOverlay } from "@/components/BuyOverlay";
import { useProtocol } from "@/hooks/useProtocol";
import { SharedNavBar } from "@/components/SharedNavBar";
import { WalletModal } from "@/components/WalletModal";

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
  const id = `section-${label.replace(/\s+/g, '-')}`;
  return (
    <div id={id} className="mb-8 relative" style={{ scrollMarginTop: "110px" }}>
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
            <EventCardInner event={event} onBuy={() => onBuy(event)} />
          </div>
        ))}
        {/* Right-edge spacer so the last card doesn't flush against the viewport */}
        <div style={{ minWidth: "16px", flexShrink: 0 }} />
      </div>
    </div>
  );
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function HomePageContent() {
  const { walletAddress, connectWallet } = useProtocol();
  const searchParams = useSearchParams();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [overlayEvent, setOverlayEvent] = useState<Event | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search if navigated from another page via Search icon
  useEffect(() => {
    if (searchParams.get("focusSearch") === "true") {
      setTimeout(() => {
        searchInputRef.current?.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }
  }, [searchParams]);

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

  // Filter events based on search
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return ALL_EVENTS;
    const q = searchQuery.toLowerCase();
    return ALL_EVENTS.filter(e => 
      e.name.toLowerCase().includes(q) || 
      e.subtitle.toLowerCase().includes(q) ||
      e.label.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group filtered events by label
  const groups = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const event of filteredEvents) {
      const bucket = map.get(event.label) ?? [];
      bucket.push(event);
      map.set(event.label, bucket);
    }
    return map;
  }, [filteredEvents]);

  const labels = Array.from(groups.keys());
  const [activeTab, setActiveTab] = useState<string>(labels[0] || "");

  const handleTabClick = (label: string) => {
    setActiveTab(label);
    const el = document.getElementById(`section-${label.replace(/\s+/g, '-')}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSearchClick = () => {
    searchInputRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto pb-32" style={{ background: "#000" }}>
      <div className="sticky top-0 z-40 pt-10 pb-3" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
        
        {/* Top Search Bar - Raised and Slimmer */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-1.5">
            <IconSearch />
            <input 
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for event"
              className="flex-1 bg-transparent border-none outline-none text-white text-[15px] placeholder-[#8E8E93]"
            />
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-6 overflow-x-auto hide-scrollbar px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {labels.map((label) => {
            const isActive = activeTab === label;
            return (
              <button
                key={label}
                onClick={() => handleTabClick(label)}
                className="flex flex-col items-start gap-1 flex-shrink-0"
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
        {filteredEvents.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[#8E8E93] text-[15px]">No events found for "{searchQuery}"</p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([label, events]) => (
            <EventSection key={label} label={label} events={events} onBuy={openBuy} />
          ))
        )}
      </div>

      <SharedNavBar 
        onWalletClick={() => setWalletModalOpen(true)} 
        onSearchClick={handleSearchClick}
      />

      <BuyOverlay event={overlayEvent} visible={overlayVisible} onClose={closeBuy} />

      <WalletModal
        visible={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={connectWallet}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
