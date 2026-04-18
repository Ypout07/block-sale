"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useProtocol } from "@/hooks/useProtocol";

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#8E8E93"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconTicket({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#8E8E93"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a1 1 0 011-1h.5a1.5 1.5 0 000-3H3a1 1 0 01-1-1V5a2 2 0 012-2h14a2 2 0 012 2v1a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3H20a1 1 0 011 1v1a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3H20a1 1 0 011 1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1 1 0 011-1h.5a1.5 1.5 0 000-3H3a1 1 0 01-1-1V9z" />
    </svg>
  );
}

function IconActivity({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#8E8E93"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconB() {
  return (
    <span style={{ 
      fontFamily: "'Great Vibes', cursive", 
      fontSize: "22px", 
      color: "white", 
      fontWeight: "900",
      display: "inline-block",
      lineHeight: "1",
      marginTop: "2px",
      marginLeft: "2px",
      WebkitTextStroke: "1px white",
      textShadow: "0 0 1px white"
    }}>B</span>
  );
}

export function SharedNavBar({ onWalletClick, onSearchClick }: { onWalletClick: () => void, onSearchClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { walletAddress } = useProtocol();
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsVisible(true), 250);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleInternalSearchClick = () => {
    if (pathname === "/") {
      onSearchClick?.();
    } else {
      router.push("/?focusSearch=true");
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-end justify-between px-6 pb-3 z-[100]"
      style={{ 
        background: "rgba(10,10,10,0.92)", 
        backdropFilter: "blur(24px)", 
        borderTop: "1px solid rgba(255,255,255,0.08)",
        height: "66px",
        transform: isVisible ? "translateY(0)" : "translateY(120%)",
        transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none"
      }}
    >
      {/* Left Side Group */}
      <div className="flex items-center gap-9 flex-1 justify-start">
        <Link href="/" className="flex flex-col items-center gap-1">
          <IconHome active={pathname === "/"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/" ? "#F06E1D" : "#8E8E93" }}>Home</span>
        </Link>
        <Link href="/tickets" className="flex flex-col items-center gap-1">
          <IconTicket active={pathname === "/tickets"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/tickets" ? "#F06E1D" : "#8E8E93" }}>Tickets</span>
        </Link>
      </div>

      {/* Center Circular Wallet Button */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={onWalletClick}
          className="rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-10"
          style={{ 
            background: "#F06E1D", 
            boxShadow: "0 8px 30px rgba(240, 110, 29, 0.5)",
            border: "5px solid #000",
            width: "62px",
            height: "62px",
            marginBottom: "12px"
          }}
        >
          <IconB />
        </button>
        <div className="absolute bottom-0 flex flex-col items-center">
          <span className="text-[10px] font-black text-[#F06E1D] uppercase tracking-wider">
            {walletAddress ? walletAddress.slice(-4).toUpperCase() : "Wallet"}
          </span>
          {walletAddress && <div className="w-1 h-1 rounded-full bg-[#34C759] mt-0.5" />}
        </div>
      </div>

      {/* Right Side Group */}
      <div className="flex items-center gap-9 flex-1 justify-end">
        <Link href="/claim" className="flex flex-col items-center gap-1">
          <IconActivity active={pathname === "/claim"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/claim" ? "#F06E1D" : "#8E8E93" }}>Activity</span>
        </Link>
        <button onClick={handleInternalSearchClick} className="flex flex-col items-center gap-1">
          <IconSearch />
          <span className="text-[10px] font-bold" style={{ color: "#8E8E93" }}>Search</span>
        </button>
      </div>
    </nav>
  );
}
