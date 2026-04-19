"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeScanner } from "html5-qrcode";
import { ResultOverlay } from "@/components/ResultOverlay";

export default function ScanPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "processing" | "correct" | "denied">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Only init if not already initialized
    if (scannerRef.current) return;

    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, // Lower FPS gives the browser more time to decode dense JSON QR codes
        useBarCodeDetectorIfSupported: true, // Use blazing fast native OS ML vision models if available
        qrbox: { width: 350, height: 350 }, // A large box forces the library to crop at high-res instead of downscaling the full frame
        videoConstraints: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: { ideal: "environment" },
          advanced: [{ focusMode: "continuous" }] as any // Request continuous autofocus
        }
      },
      false
    );

    let isScanning = true;

    scannerRef.current.render(
      async (decodedText) => {
        if (!isScanning) return;
        isScanning = false; // Prevent multiple scans while processing
        setStatus("processing"); // Show processing UI immediately!

        try {
          const res = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: decodedText }),
          });

          const data = await res.json();
          if (data.success) {
            setStatus("correct");
          } else {
            setErrorMessage(data.error || "Unknown error occurred");
            setStatus("denied");
          }
        } catch (error) {
          setErrorMessage("Failed to connect to verification server.");
          setStatus("denied");
        }

        // Allow scanning again faster
        setTimeout(() => {
          isScanning = true;
        }, 1500);
      },
      (err) => {
        // Ignore normal scan failures (when no code is present)
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col items-center">
      <header className="w-full p-6 flex justify-between items-center z-10">
        <button 
          onClick={() => router.push("/")}
          className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold tracking-widest text-[#F06E1D] uppercase">Live Scan</span>
          <span className="text-sm font-medium text-white/50">Point camera at ticket</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md px-6 flex flex-col items-center justify-center relative">
        {/* Dynamic laser background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#F06E1D]/20 rounded-full blur-[80px] animate-pulse"></div>

        <div className="w-full bg-[#141416] border border-white/10 p-2 rounded-[32px] shadow-2xl relative z-10 overflow-hidden">
          <div id="qr-reader" className="w-full rounded-[24px] overflow-hidden [&_video]:rounded-[24px] [&_video]:object-cover [&_#qr-reader__scan_region]:min-h-[300px]"></div>
          
          {/* Scanning Animation Overlay */}
          <div className="absolute inset-2 pointer-events-none rounded-[24px] overflow-hidden z-20 shadow-[inset_0_0_0_2px_rgba(240,110,29,0.5)]">
             <div className="w-full h-1 bg-[#F06E1D] shadow-[0_0_15px_#F06E1D] animate-[scan_2s_ease-in-out_infinite_alternate]"></div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Scanner Active</span>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scan {
            0% { transform: translateY(0); }
            100% { transform: translateY(300px); }
          }
          /* Hide default html5-qrcode UI elements that are ugly */
          #qr-reader__dashboard_section_csr span,
          #qr-reader__dashboard_section_swaplink { display: none !important; }
          #qr-reader { border: none !important; }
          #qr-reader button { 
            background: #F06E1D !important;
            color: white !important;
            border: none !important;
            padding: 10px 20px !important;
            border-radius: 12px !important;
            font-weight: bold !important;
            margin-top: 10px !important;
          }
          #qr-reader select {
            background: #2C2C2E !important;
            color: white !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            padding: 8px !important;
            border-radius: 8px !important;
          }
        `}} />
      </main>

      <ResultOverlay 
        status={status} 
        errorMessage={errorMessage}
        onClose={() => setStatus("idle")} 
      />
    </div>
  );
}
