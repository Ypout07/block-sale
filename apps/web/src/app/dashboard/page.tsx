"use client";

import Link from "next/link";

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

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto pb-24" style={{ background: "#000" }}>
      <div className="pt-14 pb-4 px-4">
        <h1 className="text-[28px] font-bold text-white tracking-tight uppercase">Protocol Dashboard</h1>
        <p className="text-[14px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
          Venue inventory, returns, waitlist, and treasury state management.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#1C1C1E] flex items-center justify-center mx-auto mb-4 border border-white/5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <p className="text-white font-semibold text-[17px]">Under Construction</p>
          <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            The venue portal is currently being finalized.
          </p>
        </div>
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
          <IconTicketNav />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>My Tickets</span>
        </Link>
        <Link href="/claim" className="flex flex-col items-center gap-1">
          <IconList />
          <span className="text-[10px] font-semibold" style={{ color: "#636366" }}>Activity</span>
        </Link>
      </nav>
    </div>
  );
}
