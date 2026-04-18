import { create } from "zustand";

type WalletState = {
  walletAddress: string | null;
  setWalletAddress: (walletAddress: string | null) => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  walletAddress: null,
  setWalletAddress: (walletAddress) => set({ walletAddress })
}));
