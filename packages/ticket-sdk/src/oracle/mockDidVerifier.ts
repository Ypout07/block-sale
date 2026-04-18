export type WalletDidAuth = {
  schemaVersion: 1;
  subjectType: "human-to-wallet";
  wallet: string;
  provider: string;
  subjectIdHash: string;
  verifiedAt: string;
  expiresAt: string;
  authToken: string;
  credentialIssuer?: string;
  credentialType?: string;
  credentialLedgerIndex?: string;
};

export type DidVerificationResult = {
  wallet: string;
  verified: boolean;
  provider: string;
  reason?: string;
  artifact?: WalletDidAuth;
};

export type AuthenticateWalletInput = {
  wallet: string;
  subjectId?: string;
  provider?: string;
  issuedAt?: Date;
  ttlMs?: number;
  issuerAddress?: string;
  credentialType?: string;
  xrplClient?: {
    request: (request: Record<string, unknown>) => Promise<{ result: unknown }>;
  };
  submitCredentialCreate?: (tx: Record<string, unknown>) => Promise<unknown>;
  submitCredentialAccept?: (tx: Record<string, unknown>) => Promise<unknown>;
};

export type VerifyDidInput = {
  wallet: string;
  artifact?: WalletDidAuth;
  now?: Date;
};

export type DidAuthProvider = {
  authenticateWallet: (input: AuthenticateWalletInput) => Promise<WalletDidAuth>;
  verifyWallet: (input: VerifyDidInput) => Promise<DidVerificationResult>;
};

const DEFAULT_PROVIDER = "mock-phone-proof";

function iso(date: Date) {
  return date.toISOString();
}

function isClassicAddress(wallet: string) {
  return wallet.length > 20 && wallet.startsWith("r");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildSubjectIdHash(provider: string, wallet: string, subjectId: string) {
  return sha256Hex([provider, wallet, subjectId].join("|"));
}

async function buildAuthToken(artifact: Omit<WalletDidAuth, "authToken">) {
  return sha256Hex(
    [
      String(artifact.schemaVersion),
      artifact.subjectType,
      artifact.wallet,
      artifact.provider,
      artifact.subjectIdHash,
      artifact.verifiedAt,
      artifact.expiresAt
    ].join("|")
  );
}

export async function authenticateWallet(input: AuthenticateWalletInput): Promise<WalletDidAuth> {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!isClassicAddress(input.wallet)) {
    throw new Error(`Wallet ${input.wallet} is not a valid XRPL classic address.`);
  }

  const provider = input.provider ?? DEFAULT_PROVIDER;
  const issuedAt = input.issuedAt ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + (input.ttlMs ?? 10 * 60_000));
  const subjectIdHash = await buildSubjectIdHash(provider, input.wallet, input.subjectId ?? input.wallet);
  const artifactWithoutToken = {
    schemaVersion: 1 as const,
    subjectType: "human-to-wallet" as const,
    wallet: input.wallet,
    provider,
    subjectIdHash,
    verifiedAt: iso(issuedAt),
    expiresAt: iso(expiresAt)
  };

  return {
    ...artifactWithoutToken,
    authToken: await buildAuthToken(artifactWithoutToken)
  };
}

export async function verifyDid(input: VerifyDidInput): Promise<DidVerificationResult> {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (!isClassicAddress(input.wallet)) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: DEFAULT_PROVIDER,
      reason: "Wallet format is invalid."
    };
  }

  if (!input.artifact) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: DEFAULT_PROVIDER,
      reason: "No DID authentication artifact was provided."
    };
  }

  if (input.artifact.wallet !== input.wallet) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: input.artifact.provider,
      reason: "DID artifact wallet does not match the requested wallet."
    };
  }

  if (input.artifact.subjectType !== "human-to-wallet" || input.artifact.schemaVersion !== 1) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: input.artifact.provider,
      reason: "DID artifact schema is invalid."
    };
  }

  const expectedAuthToken = await buildAuthToken({
    schemaVersion: input.artifact.schemaVersion,
    subjectType: input.artifact.subjectType,
    wallet: input.artifact.wallet,
    provider: input.artifact.provider,
    subjectIdHash: input.artifact.subjectIdHash,
    verifiedAt: input.artifact.verifiedAt,
    expiresAt: input.artifact.expiresAt
  });

  if (expectedAuthToken !== input.artifact.authToken) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: input.artifact.provider,
      reason: "DID artifact token is invalid."
    };
  }

  const now = input.now ?? new Date();
  if (new Date(input.artifact.expiresAt).getTime() < now.getTime()) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: input.artifact.provider,
      reason: "DID artifact has expired."
    };
  }

  return {
    wallet: input.wallet,
    verified: true,
    provider: input.artifact.provider,
    artifact: input.artifact
  };
}

export const mockDidAuthProvider: DidAuthProvider = {
  authenticateWallet,
  verifyWallet: verifyDid
};
