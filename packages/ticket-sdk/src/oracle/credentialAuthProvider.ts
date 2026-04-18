import {
  type AuthenticateWalletInput,
  type DidAuthProvider,
  type DidVerificationResult,
  type WalletDidAuth
} from "./mockDidVerifier.js";

export type CredentialAuthProviderConfig = {
  xrplClient: {
    request: (request: Record<string, unknown>) => Promise<{ result: unknown }>;
  };
  defaultIssuerAddress?: string;
  defaultCredentialType?: string;
};

export type CredentialProvisionResult = {
  status: "planned" | "provisioned";
  artifact: WalletDidAuth;
  credentialCreateTx: Record<string, unknown>;
  credentialAcceptTx: Record<string, unknown>;
  createResult?: unknown;
  acceptResult?: unknown;
};

const XRPL_CREDENTIAL_PROVIDER = "xrpl-credential";
const DEFAULT_CREDENTIAL_TYPE = "human_to_wallet";
const ACCEPTED_CREDENTIAL_FLAG = 0x00010000;

function iso(date: Date) {
  return date.toISOString();
}

function rippleTimeFromDate(date: Date) {
  return Math.floor(date.getTime() / 1000) - 946684800;
}

function hexFromUtf8(value: string) {
  return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unwrapTxResult(candidate: unknown): Record<string, any> {
  if (candidate && typeof candidate === "object" && "raw" in candidate) {
    const raw = (candidate as { raw?: unknown }).raw;
    if (raw && typeof raw === "object") {
      return raw as Record<string, any>;
    }
  }

  if (candidate && typeof candidate === "object" && "result" in candidate) {
    const nested = (candidate as { result?: unknown }).result;
    if (nested && typeof nested === "object") {
      return nested as Record<string, any>;
    }
  }

  if (candidate && typeof candidate === "object") {
    return candidate as Record<string, any>;
  }

  return {};
}

function extractHash(candidate: unknown): string | undefined {
  const result = unwrapTxResult(candidate);
  if (typeof result.hash === "string") {
    return result.hash;
  }

  if (typeof result.tx_json?.hash === "string") {
    return result.tx_json.hash;
  }

  return undefined;
}

function isSuccessfulTx(candidate: unknown) {
  const result = unwrapTxResult(candidate);
  return result.accepted === true || result.meta?.TransactionResult === "tesSUCCESS" || result.transactionResult === "tesSUCCESS";
}

function buildCredentialKey(wallet: string, issuerAddress: string, credentialTypeHex: string) {
  return `${wallet}:${issuerAddress}:${credentialTypeHex}`;
}

function normalizeCredentialType(input?: string) {
  return hexFromUtf8(input ?? DEFAULT_CREDENTIAL_TYPE);
}

async function fetchAcceptedCredential(
  xrplClient: CredentialAuthProviderConfig["xrplClient"],
  wallet: string,
  issuerAddress: string,
  credentialTypeHex: string
) {
  const response = await xrplClient.request({
    command: "account_objects",
    account: wallet
  });

  const objects = (response.result as { account_objects?: Array<Record<string, unknown>> }).account_objects ?? [];
  return (
    objects.find((entry) => {
      const flags = typeof entry.Flags === "number" ? entry.Flags : 0;
      return (
        entry.LedgerEntryType === "Credential" &&
        entry.Subject === wallet &&
        entry.Issuer === issuerAddress &&
        entry.CredentialType === credentialTypeHex &&
        (flags & ACCEPTED_CREDENTIAL_FLAG) === ACCEPTED_CREDENTIAL_FLAG
      );
    }) ?? null
  );
}

async function buildCredentialArtifact(input: {
  wallet: string;
  issuerAddress: string;
  credentialTypeHex: string;
  ledgerCredential?: Record<string, unknown> | null;
  issuedAt?: Date;
  ttlMs?: number;
}) {
  const issuedAt = input.issuedAt ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + (input.ttlMs ?? 10 * 60_000));
  const subjectIdHash = await sha256Hex(buildCredentialKey(input.wallet, input.issuerAddress, input.credentialTypeHex));
  const authToken = await sha256Hex(
    [
      XRPL_CREDENTIAL_PROVIDER,
      input.wallet,
      input.issuerAddress,
      input.credentialTypeHex,
      String(input.ledgerCredential?.index ?? input.ledgerCredential?.LedgerIndex ?? "")
    ].join("|")
  );

  return {
    schemaVersion: 1 as const,
    subjectType: "human-to-wallet" as const,
    wallet: input.wallet,
    provider: XRPL_CREDENTIAL_PROVIDER,
    subjectIdHash,
    verifiedAt: iso(issuedAt),
    expiresAt: iso(expiresAt),
    authToken,
    credentialIssuer: input.issuerAddress,
    credentialType: input.credentialTypeHex,
    credentialLedgerIndex: typeof input.ledgerCredential?.index === "string"
      ? input.ledgerCredential.index
      : typeof input.ledgerCredential?.LedgerIndex === "string"
        ? input.ledgerCredential.LedgerIndex
        : undefined
  } satisfies WalletDidAuth;
}

export function buildCredentialCreateTx(input: {
  issuerAddress: string;
  wallet: string;
  credentialType?: string;
  issuedAt?: Date;
  ttlMs?: number;
}) {
  const issuedAt = input.issuedAt ?? new Date();
  const credentialTypeHex = normalizeCredentialType(input.credentialType);
  return {
    TransactionType: "CredentialCreate",
    Account: input.issuerAddress,
    Subject: input.wallet,
    CredentialType: credentialTypeHex,
    Expiration: rippleTimeFromDate(new Date(issuedAt.getTime() + (input.ttlMs ?? 10 * 60_000)))
  };
}

export function buildCredentialAcceptTx(input: {
  issuerAddress: string;
  wallet: string;
  credentialType?: string;
}) {
  return {
    TransactionType: "CredentialAccept",
    Account: input.wallet,
    Issuer: input.issuerAddress,
    CredentialType: normalizeCredentialType(input.credentialType)
  };
}

export async function verifyCredentialWallet(input: {
  wallet: string;
  artifact?: WalletDidAuth;
  xrplClient: CredentialAuthProviderConfig["xrplClient"];
  now?: Date;
}): Promise<DidVerificationResult> {
  if (!input.artifact) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: XRPL_CREDENTIAL_PROVIDER,
      reason: "No credential auth artifact was provided."
    };
  }

  if (input.artifact.provider !== XRPL_CREDENTIAL_PROVIDER) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: input.artifact.provider,
      reason: "Auth artifact is not an XRPL credential artifact."
    };
  }

  if (input.artifact.wallet !== input.wallet) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: XRPL_CREDENTIAL_PROVIDER,
      reason: "Credential auth artifact wallet does not match."
    };
  }

  if (!input.artifact.credentialIssuer || !input.artifact.credentialType) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: XRPL_CREDENTIAL_PROVIDER,
      reason: "Credential auth artifact is missing issuer or credential type."
    };
  }

  const now = input.now ?? new Date();
  if (new Date(input.artifact.expiresAt).getTime() < now.getTime()) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: XRPL_CREDENTIAL_PROVIDER,
      reason: "Credential auth artifact has expired."
    };
  }

  const ledgerCredential = await fetchAcceptedCredential(
    input.xrplClient,
    input.wallet,
    input.artifact.credentialIssuer,
    input.artifact.credentialType
  );

  if (!ledgerCredential) {
    return {
      wallet: input.wallet,
      verified: false,
      provider: XRPL_CREDENTIAL_PROVIDER,
      reason: "Accepted on-ledger credential was not found for this wallet."
    };
  }

  return {
    wallet: input.wallet,
    verified: true,
    provider: XRPL_CREDENTIAL_PROVIDER,
    artifact: {
      ...input.artifact,
      credentialLedgerIndex:
        typeof ledgerCredential.index === "string"
          ? ledgerCredential.index
          : typeof ledgerCredential.LedgerIndex === "string"
            ? ledgerCredential.LedgerIndex
            : input.artifact.credentialLedgerIndex
    }
  };
}

export async function provisionCredentialAuth(
  input: AuthenticateWalletInput & { xrplClient: CredentialAuthProviderConfig["xrplClient"] }
): Promise<CredentialProvisionResult> {
  const issuerAddress = input.issuerAddress;
  if (!issuerAddress) {
    throw new Error("provisionCredentialAuth requires issuerAddress.");
  }

  const credentialTypeHex = normalizeCredentialType(input.credentialType);
  const credentialCreateTx = buildCredentialCreateTx({
    issuerAddress,
    wallet: input.wallet,
    credentialType: input.credentialType,
    issuedAt: input.issuedAt,
    ttlMs: input.ttlMs
  });
  const credentialAcceptTx = buildCredentialAcceptTx({
    issuerAddress,
    wallet: input.wallet,
    credentialType: input.credentialType
  });

  if (!input.submitCredentialCreate || !input.submitCredentialAccept) {
    const existing = await fetchAcceptedCredential(input.xrplClient, input.wallet, issuerAddress, credentialTypeHex);
    if (!existing) {
      throw new Error("Credential provisioning requires submitCredentialCreate and submitCredentialAccept or an existing accepted credential.");
    }

    return {
      status: "planned",
      artifact: await buildCredentialArtifact({
        wallet: input.wallet,
        issuerAddress,
        credentialTypeHex,
        ledgerCredential: existing,
        issuedAt: input.issuedAt,
        ttlMs: input.ttlMs
      }),
      credentialCreateTx,
      credentialAcceptTx
    };
  }

  const createResult = await input.submitCredentialCreate(credentialCreateTx);
  if (!isSuccessfulTx(createResult)) {
    throw new Error(`CredentialCreate failed${extractHash(createResult) ? ` (${extractHash(createResult)})` : ""}.`);
  }

  const acceptResult = await input.submitCredentialAccept(credentialAcceptTx);
  if (!isSuccessfulTx(acceptResult)) {
    throw new Error(`CredentialAccept failed${extractHash(acceptResult) ? ` (${extractHash(acceptResult)})` : ""}.`);
  }

  const existing = await fetchAcceptedCredential(input.xrplClient, input.wallet, issuerAddress, credentialTypeHex);
  if (!existing) {
    throw new Error("Credential provisioning submitted successfully but no accepted credential was found on ledger.");
  }

  return {
    status: "provisioned",
    artifact: await buildCredentialArtifact({
      wallet: input.wallet,
      issuerAddress,
      credentialTypeHex,
      ledgerCredential: existing,
      issuedAt: input.issuedAt,
      ttlMs: input.ttlMs
    }),
    credentialCreateTx,
    credentialAcceptTx,
    createResult,
    acceptResult
  };
}

export function createCredentialAuthProvider(config: CredentialAuthProviderConfig): DidAuthProvider {
  return {
    async authenticateWallet(input: AuthenticateWalletInput) {
      const issuerAddress = input.issuerAddress ?? config.defaultIssuerAddress;
      if (!issuerAddress) {
        throw new Error("Credential auth provider requires issuerAddress.");
      }

      const provisioned = await provisionCredentialAuth({
        ...input,
        issuerAddress,
        credentialType: input.credentialType ?? config.defaultCredentialType ?? DEFAULT_CREDENTIAL_TYPE,
        xrplClient: input.xrplClient ?? config.xrplClient
      });

      return provisioned.artifact;
    },
    async verifyWallet({ wallet, artifact, now }) {
      return verifyCredentialWallet({
        wallet,
        artifact,
        xrplClient: config.xrplClient,
        now
      });
    }
  };
}
