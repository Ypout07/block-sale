import {
  mockDidAuthProvider,
  type DidAuthProvider,
  type WalletDidAuth
} from "../oracle/mockDidVerifier.js";

export type PermissionedDomainCredential = {
  issuer: string;
  credentialType: string;
};

export type PermissionedDomainRuntime = {
  authProvider?: DidAuthProvider;
  submitDomainSet?: (tx: Record<string, unknown>) => Promise<unknown>;
  submitDomainDelete?: (tx: Record<string, unknown>) => Promise<unknown>;
};

export type SetPermissionedDomainInput = {
  wallet: string;
  acceptedCredentials: PermissionedDomainCredential[];
  domainId?: string;
  didAuth?: WalletDidAuth;
  runtime?: PermissionedDomainRuntime;
};

export type DeletePermissionedDomainInput = {
  wallet: string;
  domainId: string;
  didAuth?: WalletDidAuth;
  runtime?: PermissionedDomainRuntime;
};

export type PermissionedDomainResult = {
  status: "planned" | "submitted";
  tx: Record<string, unknown>;
  result?: unknown;
};

function buildAcceptedCredentials(credentials: PermissionedDomainCredential[]) {
  if (credentials.length === 0) {
    throw new Error("Permissioned domains require at least one accepted credential.");
  }

  return credentials.map((credential) => ({
    Credential: {
      Issuer: credential.issuer,
      CredentialType: credential.credentialType
    }
  }));
}

export async function setPermissionedDomain(input: SetPermissionedDomainInput): Promise<PermissionedDomainResult> {
  const authProvider = input.runtime?.authProvider ?? mockDidAuthProvider;
  const didVerification = await authProvider.verifyWallet({
    wallet: input.wallet,
    artifact: input.didAuth
  });
  if (!didVerification.verified) {
    throw new Error(didVerification.reason ?? "setPermissionedDomain requires a verified auth artifact.");
  }

  const tx = {
    TransactionType: "PermissionedDomainSet",
    Account: input.wallet,
    ...(input.domainId ? { DomainID: input.domainId } : {}),
    AcceptedCredentials: buildAcceptedCredentials(input.acceptedCredentials)
  };

  if (!input.runtime?.submitDomainSet) {
    return {
      status: "planned",
      tx
    };
  }

  return {
    status: "submitted",
    tx,
    result: await input.runtime.submitDomainSet(tx)
  };
}

export async function deletePermissionedDomain(
  input: DeletePermissionedDomainInput
): Promise<PermissionedDomainResult> {
  const authProvider = input.runtime?.authProvider ?? mockDidAuthProvider;
  const didVerification = await authProvider.verifyWallet({
    wallet: input.wallet,
    artifact: input.didAuth
  });
  if (!didVerification.verified) {
    throw new Error(didVerification.reason ?? "deletePermissionedDomain requires a verified auth artifact.");
  }

  const tx = {
    TransactionType: "PermissionedDomainDelete",
    Account: input.wallet,
    DomainID: input.domainId
  };

  if (!input.runtime?.submitDomainDelete) {
    return {
      status: "planned",
      tx
    };
  }

  return {
    status: "submitted",
    tx,
    result: await input.runtime.submitDomainDelete(tx)
  };
}
