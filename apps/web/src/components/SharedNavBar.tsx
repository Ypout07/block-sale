"use client";

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

function IconScan({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#F06E1D" : "#8E8E93"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 14a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" fill="white" stroke="none" />
      <path d="M22 11V7a2 2 0 0 0-2-2H6a2 2 0 0 1-2-2" />
    </svg>
  );
}

export function SharedNavBar({ onWalletClick, forceVisible }: { onWalletClick: () => void, forceVisible?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { walletAddress } = useProtocol();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) < 5) return;
      setIsVisible(delta < 0 || currentY < 10);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-end justify-between px-6 pb-3 z-[100]"
      style={{ 
        background: "rgba(10,10,10,0.92)", 
        backdropFilter: "blur(24px)", 
        borderTop: "1px solid rgba(255,255,255,0.08)",
        height: "66px",
        transform: (forceVisible || isVisible) ? "translateY(0)" : "translateY(120%)",
        transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease",
        opacity: (forceVisible || isVisible) ? 1 : 0,
        pointerEvents: (forceVisible || isVisible) ? "auto" : "none"
      }}
    >
      {/* Left Side Group */}
      <div className="flex items-center gap-9 flex-1 justify-start">
        <button onClick={() => router.push("/")} className="flex flex-col items-center gap-1" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}>
          <IconHome active={pathname === "/"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/" ? "#F06E1D" : "#8E8E93" }}>Home</span>
        </button>
        <button onClick={() => router.push("/tickets")} className="flex flex-col items-center gap-1" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}>
          <IconTicket active={pathname === "/tickets"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/tickets" ? "#F06E1D" : "#8E8E93" }}>Tickets</span>
        </button>
      </div>

      {/* Center Circular Wallet Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onWalletClick}
          className="rounded-full flex items-center justify-center active:scale-95 z-10"
          style={{
            background: "#F06E1D",
            border: "5px solid #000",
            width: "62px",
            height: "62px",
          }}
        >
          <IconWallet />
        </button>
        <span className="text-[10px] font-black text-[#F06E1D] uppercase tracking-wider">
          {walletAddress ? walletAddress.slice(-4).toUpperCase() : "Wallet"}
        </span>
      </div>

      {/* Right Side Group */}
      <div className="flex items-center gap-9 flex-1 justify-end">
        <button onClick={() => router.push("/claim")} className="flex flex-col items-center gap-1" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}>
          <IconActivity active={pathname === "/claim"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/claim" ? "#F06E1D" : "#8E8E93" }}>Activity</span>
        </button>
        <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}>
          <IconScan active={pathname === "/dashboard"} />
          <span className="text-[10px] font-bold" style={{ color: pathname === "/dashboard" ? "#F06E1D" : "#8E8E93" }}>Scan</span>
        </button>
      </div>
    </nav>
  );
}
