import { create } from "zustand";
import type { WalletDidAuth } from "@sdk/oracle/mockDidVerifier";

export type { WalletDidAuth };

type WalletState = {
  walletAddress: string | null;
  didAuth: WalletDidAuth | null;
  setWalletAddress: (address: string | null) => void;
  setDidAuth: (auth: WalletDidAuth | null) => void;
  disconnect: () => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  walletAddress: null,
  didAuth: null,
  setWalletAddress: (address) => set({ walletAddress: address }),
  setDidAuth: (auth) => set({ didAuth: auth }),
  disconnect: () => set({ walletAddress: null, didAuth: null }),
}));
