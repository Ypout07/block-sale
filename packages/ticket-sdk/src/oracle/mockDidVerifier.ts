export async function verifyDid(wallet: string) {
  return {
    wallet,
    verified: wallet.trim().length > 0,
    provider: "mock-phone-proof"
  };
}
