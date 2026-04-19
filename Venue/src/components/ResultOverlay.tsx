"use client";

import { useEffect } from "react";

type Props = {
  status: "idle" | "processing" | "correct" | "denied";
  errorMessage?: string;
  onClose: () => void;
};

export function ResultOverlay({ status, errorMessage, onClose }: Props) {
  useEffect(() => {
    if (status === "idle" || status === "processing") return;
    
    // Auto-close after a few seconds only for correct/denied
    const timer = setTimeout(() => {
      onClose();
    }, 1500); // Increased slightly so they can read the error
    
    return () => clearTimeout(timer);
  }, [status, onClose]);

  if (status === "idle") return null;

  const isProcessing = status === "processing";
  const isCorrect = status === "correct";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 backdrop-blur-md ${
          isProcessing ? "bg-black/60" :
          isCorrect ? "bg-green-950/60" : "bg-red-950/60"
        }`}
        onClick={isProcessing ? undefined : onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full max-w-sm rounded-[32px] p-8 flex flex-col items-center justify-center transform transition-all duration-500 ${
          isProcessing ? "bg-[#141416] border-2 border-white/10 shadow-2xl animate-in fade-in" :
          isCorrect 
            ? "bg-[#141A14] border-2 border-green-500/30 shadow-[0_0_80px_rgba(34,197,94,0.2)] animate-in zoom-in-95" 
            : "bg-[#1A1414] border-2 border-red-500/30 shadow-[0_0_80px_rgba(239,68,68,0.2)] animate-in shake"
        }`}
      >
        <div 
          className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
            isProcessing ? "text-[#F06E1D]" :
            isCorrect ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
          }`}
        >
          {isProcessing ? (
            <svg className="animate-spin w-16 h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : isCorrect ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </div>
        
        <h2 className={`text-3xl font-black mb-2 text-center ${
          isProcessing ? "text-white" :
          isCorrect ? "text-green-500" : "text-red-500"
        }`}>
          {isProcessing ? "VERIFYING..." : isCorrect ? "VALID" : "DENIED"}
        </h2>
        
        <p className="text-white/60 text-center font-medium">
          {isProcessing ? "Checking ticket securely on the ledger..." :
           isCorrect ? "Ticket verified. Enjoy the event!" : 
           errorMessage || "Invalid or unauthorized ticket. Please check again."}
        </p>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
            20%, 40%, 60%, 80% { transform: translateX(8px); }
          }
          .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        `}} />
      </div>
    </div>
  );
}
