import fs from "node:fs";
import path from "node:path";
import xrpl from "xrpl";

const {
  Client,
  Wallet,
  MPTokenIssuanceCreateFlags,
  AccountSetAsfFlags,
  BatchFlags,
  GlobalFlags,
  TrustSetFlags,
  combineBatchSigners,
  signMultiBatch,
  decode,
  encode,
  decodeAccountID
} = xrpl;

export const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";
export const USD_CURRENCY = "USD";
export const PRIMARY_PURCHASE_AMOUNT = "50";
export const BUYER_TOP_UP_AMOUNT = "100";
export const STANDALONE_GENESIS_SEED = "snoPBrXtMeMyMHUVTgbuqAfg1SUTb";
export const STANDALONE_GENESIS_ADDRESS = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
export const STANDALONE_STARTING_XRP_DROPS = "1000000000";

export type DevnetConfig = {
  networkWsUrl?: string;
  networkLabel?: string;
  vendorPoolAddress?: string;
  vendorPoolSeed?: string;
  holderAddress?: string;
  holderSeed?: string;
  secondaryHolderAddress?: string;
  secondaryHolderSeed?: string;
  waitlistAddress?: string;
  waitlistSeed?: string;
  unauthorizedRecipientAddress?: string;
  unauthorizedRecipientSeed?: string;
  mptIssuanceId?: string;
  rlusdIssuer?: string;
  rlusdIssuerSeed?: string;
  lastHookHash?: string;
};

export type HookParamArtifact = {
  name: string;
  hex: string;
  description: string;
};

export type HookExecutionSummary = {
  hookHash?: string;
  result?: string;
  returnCode?: number;
  returnString?: string;
};

export type SubmittedTx = {
  label: string;
  hash?: string;
  transactionResult?: string;
  accepted: boolean;
  hookExecutions: HookExecutionSummary[];
  raw: unknown;
};

export type PrimaryContext = {
  client: InstanceType<typeof Client>;
  configPath: string;
  config: DevnetConfig;
  vendorWallet: InstanceType<typeof Wallet>;
  buyerWallet: InstanceType<typeof Wallet>;
  secondaryWallet: InstanceType<typeof Wallet>;
  issuerWallet: InstanceType<typeof Wallet>;
  issuanceId: string;
  hookParams: HookParamArtifact[];
  artifactPath: string;
};

function rootPath(...parts: string[]) {
  return path.resolve(import.meta.dirname, "..", "..", "..", "..", ...parts);
}

export function getDevnetConfigPath() {
  return rootPath("contracts", "devnet.json");
}

export function getPrimaryPolicyArtifactPath() {
  return rootPath("contracts", "build", "primary-policy-config.json");
}

export function getPrimaryAuditReportPath() {
  return rootPath("contracts", "build", "primary-policy-audit.json");
}

export function loadDevnetConfig(configPath = getDevnetConfigPath()): DevnetConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${configPath}. Run npm run setup:devnet first or create contracts/devnet.json.`);
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8")) as DevnetConfig;
}

export function saveDevnetConfig(config: DevnetConfig, configPath = getDevnetConfigPath()) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function requireField(config: DevnetConfig, key: keyof DevnetConfig): string {
  const value = config[key];
  if (!value) {
    throw new Error(`Missing required field in contracts/devnet.json: ${String(key)}`);
  }
  return value;
}

export function createClient(url = getNetworkUrl()) {
  return new Client(url);
}

export function getNetworkUrl(config?: DevnetConfig) {
  return process.env.XRPL_WS_URL || config?.networkWsUrl || DEVNET_URL;
}

export function isLocalStandaloneUrl(url: string) {
  return /^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);
}

function getClientUrl(client?: InstanceType<typeof Client>) {
  if (!client) {
    return undefined;
  }

  const directUrl = (client as { url?: unknown }).url;
  if (typeof directUrl === "string") {
    return directUrl;
  }

  const connectionUrl = (client as { connection?: { url?: unknown } }).connection?.url;
  if (typeof connectionUrl === "string") {
    return connectionUrl;
  }

  return undefined;
}

export function isLocalStandaloneClient(
  client?: InstanceType<typeof Client>,
  config?: DevnetConfig
) {
  const clientUrl = getClientUrl(client);
  if (clientUrl) {
    return isLocalStandaloneUrl(clientUrl);
  }

  return isLocalStandaloneNetwork(config);
}

export function isLocalStandaloneNetwork(config?: DevnetConfig) {
  return isLocalStandaloneUrl(getNetworkUrl(config));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStandaloneGenesisWallet() {
  return Wallet.fromSeed(STANDALONE_GENESIS_SEED, {
    algorithm: "secp256k1"
  });
}

export function computeMptIssuanceId(address: string, sequence: number) {
  const sequenceHex = sequence.toString(16).padStart(8, "0").toUpperCase();
  const accountHex = Buffer.from(decodeAccountID(address)).toString("hex").toUpperCase();
  return `${sequenceHex}${accountHex}`;
}

export function accountIdHex(address: string) {
  return Buffer.from(decodeAccountID(address)).toString("hex").toUpperCase();
}

function buildMetadataJson(name: string) {
  return JSON.stringify({
    name,
    category: "ticket",
    network: "devnet",
    protocol: "xrpl-ticketing-protocol"
  });
}

function getMeta(result: any) {
  return result?.meta ?? {};
}

export function getHookExecutions(result: any): HookExecutionSummary[] {
  const meta = getMeta(result);
  const executions = meta?.HookExecutions ?? meta?.sfHookExecutions ?? [];

  if (!Array.isArray(executions)) {
    return [];
  }

  return executions.map((entry: any) => {
    const execution = entry?.HookExecution ?? entry;
    return {
      hookHash: execution?.HookHash,
      result: execution?.HookResult ?? execution?.HookReturnString,
      returnCode: execution?.HookReturnCode,
      returnString: execution?.HookReturnString
    };
  });
}

export function summarizeTx(label: string, result: any): SubmittedTx {
  const transactionResult = getMeta(result)?.TransactionResult;
  return {
    label,
    hash: result?.hash,
    transactionResult,
    accepted: transactionResult === "tesSUCCESS",
    hookExecutions: getHookExecutions(result),
    raw: result
  };
}

async function submitBlobAndWait(
  client: InstanceType<typeof Client>,
  txBlob: string,
  txHash: string,
  config?: DevnetConfig
) {
  if (!isLocalStandaloneClient(client, config)) {
    const wrapper = await client.submitAndWait(txBlob);
    return wrapper.result;
  }

  const submitResponse = await client.request({
    command: "submit",
    tx_blob: txBlob
  });
  const submitResult = submitResponse.result as {
    engine_result?: string;
    engine_result_message?: string;
    applied?: boolean;
    accepted?: boolean;
    queued?: boolean;
  };

  if (submitResult.engine_result && submitResult.engine_result !== "tesSUCCESS" && submitResult.engine_result !== "terQUEUED") {
    const txJson = (submitResponse.result as { tx_json?: Record<string, unknown> }).tx_json;
    const txSummary = txJson
      ? ` tx=${JSON.stringify({
          Account: txJson.Account,
          Destination: txJson.Destination,
          Amount: txJson.Amount ?? txJson.DeliverMax,
          Sequence: txJson.Sequence,
          Fee: txJson.Fee,
          TransactionType: txJson.TransactionType
        })}`
      : "";
    throw new Error(
      `Local standalone submit failed with ${submitResult.engine_result}: ${submitResult.engine_result_message ?? "unknown error"}${txSummary}`
    );
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await client.request({
      command: "ledger_accept"
    });

    try {
      const txResponse = await client.request({
        command: "tx",
        transaction: txHash
      });

      if ((txResponse.result as { validated?: boolean }).validated) {
        return txResponse.result;
      }
    } catch {
      // The tx may not be queryable until the next accepted ledger.
    }

    await sleep(100);
  }

  throw new Error(`Timed out waiting for local standalone transaction ${txHash} to validate.`);
}

export async function advanceLocalStandaloneToRippleTime(
  client: InstanceType<typeof Client>,
  targetRippleTime: number,
  config?: DevnetConfig
) {
  if (!isLocalStandaloneClient(client, config)) {
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const serverInfo = await client.request({
      command: "server_info"
    });
    const serverTimeText = (serverInfo.result as { info?: { time?: string } }).info?.time;
    if (typeof serverTimeText !== "string") {
      return;
    }

    const serverTimeMs = Date.parse(serverTimeText.replace(" UTC", "Z"));
    if (!Number.isFinite(serverTimeMs)) {
      return;
    }

    const currentRippleTime = Math.floor(serverTimeMs / 1000) - 946684800;
    if (currentRippleTime >= targetRippleTime) {
      return;
    }

    await client.request({
      command: "ledger_accept"
    });
  }
}

export async function getCurrentRippleTime(
  client: InstanceType<typeof Client>
) {
  const serverInfo = await client.request({
    command: "server_info"
  });
  const serverTimeText = (serverInfo.result as { info?: { time?: string } }).info?.time;
  if (typeof serverTimeText !== "string") {
    throw new Error("server_info did not return a usable time field.");
  }

  const serverTimeMs = Date.parse(serverTimeText.replace(" UTC", "Z"));
  if (!Number.isFinite(serverTimeMs)) {
    throw new Error(`Could not parse XRPL server time: ${serverTimeText}`);
  }

  return Math.floor(serverTimeMs / 1000) - 946684800;
}

async function hookAwareFee(
  client: InstanceType<typeof Client>,
  wallet: InstanceType<typeof Wallet>,
  tx: Record<string, unknown>
) {
  const probeTx = {
    ...tx,
    Fee: "0",
    SigningPubKey: wallet.publicKey
  };

  const feeResponse = await client.request({
    command: "fee",
    tx_blob: encode(probeTx as never)
  });

  const drops = (feeResponse.result as { drops?: { base_fee?: string; open_ledger_fee?: string } }).drops;
  const baseFee = Number(drops?.base_fee ?? "0");
  const openLedgerFee = Number(drops?.open_ledger_fee ?? "0");
  return String(Math.max(baseFee, openLedgerFee, 1));
}

export async function submitTx(
  client: InstanceType<typeof Client>,
  wallet: InstanceType<typeof Wallet>,
  tx: Record<string, unknown>,
  label: string,
  options?: { throwOnFail?: boolean; log?: boolean; config?: DevnetConfig }
) {
  const throwOnFail = options?.throwOnFail ?? true;
  const shouldLog = options?.log ?? true;

  const prepared = await client.autofill(tx);
  if (typeof prepared.LastLedgerSequence === "number") {
    prepared.LastLedgerSequence += 100;
  }
  prepared.Fee = await hookAwareFee(client, wallet, prepared as unknown as Record<string, unknown>);

  const signed = wallet.sign(prepared);
  const result = await submitBlobAndWait(client, signed.tx_blob, signed.hash, options?.config);
  const summary = summarizeTx(label, result);

  if (shouldLog) {
    console.log(`\n--- ${label} ---`);
    console.log(JSON.stringify(result, null, 2));
  }

  if (throwOnFail && !summary.accepted) {
    throw new Error(`${label} failed with ${summary.transactionResult}`);
  }

  return summary;
}

export async function prepareInnerBatchTx(
  client: InstanceType<typeof Client>,
  tx: Record<string, unknown>
) {
  const prepared = await client.autofill(tx);
  prepared.Flags = (typeof prepared.Flags === "number" ? prepared.Flags : 0) | GlobalFlags.tfInnerBatchTxn;
  prepared.Fee = "0";
  prepared.SigningPubKey = "";
  prepared.LastLedgerSequence = undefined;
  prepared.TxnSignature = undefined;
  prepared.Signers = undefined;
  return prepared;
}

export async function submitNativeBatch(input: {
  client: InstanceType<typeof Client>;
  outerAccountWallet: InstanceType<typeof Wallet>;
  signingWallets: Record<string, InstanceType<typeof Wallet>>;
  innerTransactions: Record<string, unknown>[];
  label: string;
  config?: DevnetConfig;
}) {
  const preparedInnerTransactions = [];
  for (const tx of input.innerTransactions) {
    preparedInnerTransactions.push({
      RawTransaction: await prepareInnerBatchTx(input.client, tx)
    });
  }

  const outerBatch = await input.client.autofill({
    TransactionType: "Batch",
    Account: input.outerAccountWallet.address,
    Flags: BatchFlags.tfAllOrNothing,
    RawTransactions: preparedInnerTransactions
  });

  // rippled's Batch fee is higher than a normal autofilled fee:
  // batch wrapper base + batch processing base + each inner tx base + each batch signer base.
  const feeResponse = await input.client.request({
    command: "fee"
  });
  const drops = (feeResponse.result as { drops?: { base_fee?: string; open_ledger_fee?: string } }).drops;
  const baseFee = Number(drops?.base_fee ?? "10");
  const openLedgerFee = Number(drops?.open_ledger_fee ?? String(baseFee));
  const referenceFee = Math.max(baseFee, openLedgerFee, 1);

  const involvedAccounts = Array.from(
    new Set(preparedInnerTransactions.map((rawTx) => String((rawTx.RawTransaction as Record<string, unknown>).Account)))
  );
  outerBatch.Fee = String(referenceFee * (2 + preparedInnerTransactions.length + involvedAccounts.length));

  const nextSequenceByAccount = new Map<string, number>();
  for (const preparedRawTransaction of preparedInnerTransactions) {
    const rawTransaction = preparedRawTransaction.RawTransaction as Record<string, unknown>;
    const account = String(rawTransaction.Account);

    if ("TicketSequence" in rawTransaction && rawTransaction.TicketSequence != null) {
      continue;
    }

    if (!nextSequenceByAccount.has(account)) {
      const startingSequence =
        account === input.outerAccountWallet.address
          ? Number(outerBatch.Sequence) + 1
          : Number(rawTransaction.Sequence);
      nextSequenceByAccount.set(account, startingSequence);
    }

    const nextSequence = nextSequenceByAccount.get(account);
    if (typeof nextSequence === "number" && Number.isFinite(nextSequence)) {
      rawTransaction.Sequence = nextSequence;
      nextSequenceByAccount.set(account, nextSequence + 1);
    }
  }

  const signedBatchCopies: Array<Record<string, unknown>> = [];
  for (const account of involvedAccounts) {
    const signerWallet = input.signingWallets[account];
    if (!signerWallet) {
      throw new Error(`Missing signing wallet for batched account ${account}.`);
    }

    const batchCopy = structuredClone(outerBatch);
    signMultiBatch(signerWallet as any, batchCopy as any, {
      batchAccount: account
    });
    signedBatchCopies.push(batchCopy as Record<string, unknown>);
  }

  const combinedBlob = combineBatchSigners(signedBatchCopies as any);
  const combinedBatch = decode(combinedBlob) as Record<string, unknown>;
  const outerSigned = input.outerAccountWallet.sign(combinedBatch as any);
  const result = await submitBlobAndWait(input.client, outerSigned.tx_blob, outerSigned.hash, input.config);
  const summary = summarizeTx(input.label, result);

  console.log(`\n--- ${input.label} ---`);
  console.log(JSON.stringify(result, null, 2));

  if (!summary.accepted) {
    throw new Error(`${input.label} failed with ${summary.transactionResult}`);
  }

  return summary;
}

export async function enableIssuerDefaultRipple(
  client: InstanceType<typeof Client>,
  issuerWallet: InstanceType<typeof Wallet>,
  config?: DevnetConfig
) {
  return submitTx(
    client,
    issuerWallet,
    {
      TransactionType: "AccountSet",
      Account: issuerWallet.address,
      SetFlag: AccountSetAsfFlags.asfDefaultRipple
    },
    "Enable Default Ripple On Mock RLUSD Issuer",
    { config }
  );
}

export async function clearDepositAuth(
  client: InstanceType<typeof Client>,
  wallet: InstanceType<typeof Wallet>,
  label = "Clear DepositAuth",
  config?: DevnetConfig
) {
  return submitTx(
    client,
    wallet,
    {
      TransactionType: "AccountSet",
      Account: wallet.address,
      ClearFlag: AccountSetAsfFlags.asfDepositAuth
    },
    label,
    { throwOnFail: false, config }
  );
}

export async function ensureUsdTrustline(
  client: InstanceType<typeof Client>,
  wallet: InstanceType<typeof Wallet>,
  issuerAddress: string,
  label: string,
  config?: DevnetConfig
) {
  return submitTx(
    client,
    wallet,
    {
      TransactionType: "TrustSet",
      Account: wallet.address,
      LimitAmount: {
        currency: USD_CURRENCY,
        issuer: issuerAddress,
        value: "10000"
      },
      Flags: TrustSetFlags.tfClearNoRipple
    },
    label,
    { config }
  );
}

export async function fundWithMockUsd(
  client: InstanceType<typeof Client>,
  issuerWallet: InstanceType<typeof Wallet>,
  destinationAddress: string,
  amount: string,
  label: string,
  config?: DevnetConfig
) {
  return submitTx(
    client,
    issuerWallet,
    {
      TransactionType: "Payment",
      Account: issuerWallet.address,
      Destination: destinationAddress,
      Amount: {
        currency: USD_CURRENCY,
        issuer: issuerWallet.address,
        value: amount
      }
    },
    label,
    { config }
  );
}

export async function createMptIssuance(
  client: InstanceType<typeof Client>,
  vendorWallet: InstanceType<typeof Wallet>,
  config?: DevnetConfig
) {
  const issuanceTx = {
    TransactionType: "MPTokenIssuanceCreate",
    Account: vendorWallet.address,
    AssetScale: 0,
    MaximumAmount: "5000",
    TransferFee: 0,
    Flags: MPTokenIssuanceCreateFlags.tfMPTCanLock,
    MPTokenMetadata: Buffer.from(buildMetadataJson("General Admission")).toString("hex")
  };

  const prepared = await client.autofill(issuanceTx);
  prepared.Fee = await hookAwareFee(client, vendorWallet, prepared as unknown as Record<string, unknown>);
  const issuanceId = computeMptIssuanceId(vendorWallet.address, prepared.Sequence);
  const signed = vendorWallet.sign(prepared);
  const result = await submitBlobAndWait(client, signed.tx_blob, signed.hash, config);

  console.log(`\n--- Create Ticket MPT Issuance ---`);
  console.log(JSON.stringify(result, null, 2));

  const summary = summarizeTx("Create Ticket MPT Issuance", result);
  if (!summary.accepted) {
    throw new Error(`Create Ticket MPT Issuance failed with ${summary.transactionResult}`);
  }

  return { issuanceId, tx: summary };
}

async function issuanceExists(client: InstanceType<typeof Client>, issuanceId: string) {
  try {
    const response = await client.request({
      command: "ledger_entry",
      mpt_issuance: issuanceId
    });

    return Boolean((response.result as { node?: unknown }).node);
  } catch {
    return false;
  }
}

export async function ensureMptAuthorization(
  client: InstanceType<typeof Client>,
  wallet: InstanceType<typeof Wallet>,
  issuanceId: string,
  label: string,
  config?: DevnetConfig
) {
  const objects = await client.request({
    command: "account_objects",
    account: wallet.address
  });

  const existing = (objects.result as { account_objects?: Array<Record<string, unknown>> }).account_objects ?? [];
  const alreadyAuthorized = existing.some(
    (entry) => entry.LedgerEntryType === "MPToken" && entry.MPTokenIssuanceID === issuanceId
  );

  if (alreadyAuthorized) {
    return {
      label,
      hash: undefined,
      transactionResult: "already_authorized",
      accepted: true,
      hookExecutions: [],
      raw: { skipped: true }
    } satisfies SubmittedTx;
  }

  return submitTx(
    client,
    wallet,
    {
      TransactionType: "MPTokenAuthorize",
      Account: wallet.address,
      MPTokenIssuanceID: issuanceId
    },
    label,
    { config }
  );
}

export async function ensureMockUsdBalance(
  client: InstanceType<typeof Client>,
  issuerWallet: InstanceType<typeof Wallet>,
  holderWallet: InstanceType<typeof Wallet>,
  minimumBalance: string,
  label: string,
  config?: DevnetConfig
) {
  const lines = await client.request({
    command: "account_lines",
    account: holderWallet.address,
    peer: issuerWallet.address
  });

  const line = ((lines.result as { lines?: Array<Record<string, unknown>> }).lines ?? []).find(
    (candidate) => candidate.currency === USD_CURRENCY
  );

  const currentBalance = Number(line?.balance ?? "0");
  const targetBalance = Number(minimumBalance);

  if (currentBalance >= targetBalance) {
    return {
      label,
      hash: undefined,
      transactionResult: "already_funded",
      accepted: true,
      hookExecutions: [],
      raw: { skipped: true, currentBalance }
    } satisfies SubmittedTx;
  }

  const topUpAmount = String(targetBalance - currentBalance);
  return fundWithMockUsd(client, issuerWallet, holderWallet.address, topUpAmount, label, config);
}

export async function buyerPaysVendorInMockUsd(
  client: InstanceType<typeof Client>,
  buyerWallet: InstanceType<typeof Wallet>,
  issuerAddress: string,
  vendorAddress: string,
  amount = PRIMARY_PURCHASE_AMOUNT,
  label = "Buyer Pays Vendor In Mock RLUSD",
  throwOnFail = true,
  config?: DevnetConfig
) {
  return submitTx(
    client,
    buyerWallet,
    {
      TransactionType: "Payment",
      Account: buyerWallet.address,
      Destination: vendorAddress,
      Amount: {
        currency: USD_CURRENCY,
        issuer: issuerAddress,
        value: amount
      }
    },
    label,
    { throwOnFail, config }
  );
}

export async function vendorSendsTicketMpt(
  client: InstanceType<typeof Client>,
  vendorWallet: InstanceType<typeof Wallet>,
  destinationAddress: string,
  issuanceId: string,
  label: string,
  throwOnFail = true,
  config?: DevnetConfig
) {
  return submitTx(
    client,
    vendorWallet,
    {
      TransactionType: "Payment",
      Account: vendorWallet.address,
      Destination: destinationAddress,
      Amount: {
        mpt_issuance_id: issuanceId,
        value: "1"
      }
    },
    label,
    { throwOnFail, config }
  );
}

export async function ensureXrpBalance(
  client: InstanceType<typeof Client>,
  wallet: InstanceType<typeof Wallet>,
  minimumDrops = STANDALONE_STARTING_XRP_DROPS,
  label = `Fund ${wallet.address}`,
  config?: DevnetConfig
) {
  const localStandalone = isLocalStandaloneNetwork(config);

  try {
    const accountInfo = await client.request({
      command: "account_info",
      account: wallet.address
    });
    const balance = Number((accountInfo.result as { account_data?: { Balance?: string } }).account_data?.Balance ?? "0");
    if ((!localStandalone && balance > 0) || balance >= Number(minimumDrops)) {
      return {
        label,
        hash: undefined,
        transactionResult: "already_funded",
        accepted: true,
        hookExecutions: [],
        raw: { skipped: true, balance }
      } satisfies SubmittedTx;
    }
  } catch {
    // Unfunded account; continue to local genesis funding if available.
  }

  if (!localStandalone) {
    throw new Error(`Wallet ${wallet.address} is not funded and no public faucet flow is available in this audit path.`);
  }

  const genesisWallet = getStandaloneGenesisWallet();
  return submitTx(
    client,
    genesisWallet,
    {
      TransactionType: "Payment",
      Account: genesisWallet.address,
      Destination: wallet.address,
      Amount: minimumDrops
    },
    label,
    { config }
  );
}

export async function createFundedWallet(
  client: InstanceType<typeof Client>,
  config?: DevnetConfig,
  amountDrops = STANDALONE_STARTING_XRP_DROPS,
  label = "Create funded wallet"
) {
  if (!isLocalStandaloneNetwork(config)) {
    return client.fundWallet();
  }

  const wallet = Wallet.generate();
  await ensureXrpBalance(client, wallet, amountDrops, label, config);
  return { wallet };
}

export function buildHookParamArtifacts(issuerAddress: string, issuanceId: string): HookParamArtifact[] {
  return [
    {
      name: "RLU",
      hex: accountIdHex(issuerAddress),
      description: "20-byte mock RLUSD issuer account ID"
    },
    {
      name: "ISS",
      hex: issuanceId.toUpperCase(),
      description: "24-byte MPTokenIssuanceID for the ticket issuance"
    }
  ];
}

export function writePrimaryHookArtifact(context: {
  configPath: string;
  vendorAddress: string;
  buyerAddress: string;
  secondaryAddress: string;
  issuerAddress: string;
  issuanceId: string;
  hookParams: HookParamArtifact[];
  path?: string;
}) {
  const artifactPath = context.path ?? getPrimaryPolicyArtifactPath();
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceConfig: context.configPath,
        vendorAddress: context.vendorAddress,
        buyerAddress: context.buyerAddress,
        secondaryAddress: context.secondaryAddress,
        issuerAddress: context.issuerAddress,
        issuanceId: context.issuanceId,
        hookParameters: context.hookParams
      },
      null,
      2
    )
  );

  return artifactPath;
}

export async function provisionPrimaryContext(options?: {
  rotateIssuance?: boolean;
  buyerMinimumUsd?: string;
  secondaryMinimumUsd?: string;
  freshIssuer?: boolean;
}) {
  const configPath = getDevnetConfigPath();
  const config = loadDevnetConfig(configPath);
  const vendorWallet = Wallet.fromSeed(requireField(config, "vendorPoolSeed"));
  const buyerWallet = Wallet.fromSeed(requireField(config, "holderSeed"));
  const secondaryWallet = Wallet.fromSeed(requireField(config, "secondaryHolderSeed"));
  const client = createClient(getNetworkUrl(config));

  await client.connect();

  try {
    await ensureXrpBalance(client, vendorWallet, STANDALONE_STARTING_XRP_DROPS, "Fund Vendor Wallet", config);
    await ensureXrpBalance(client, buyerWallet, STANDALONE_STARTING_XRP_DROPS, "Fund Buyer Wallet", config);
    await ensureXrpBalance(client, secondaryWallet, STANDALONE_STARTING_XRP_DROPS, "Fund Secondary Wallet", config);

    let issuerWallet: InstanceType<typeof Wallet>;
    if (options?.freshIssuer ?? true) {
      const funded = await createFundedWallet(client, config, STANDALONE_STARTING_XRP_DROPS, "Create Issuer Wallet");
      issuerWallet = funded.wallet;
      config.rlusdIssuerSeed = issuerWallet.seed;
      config.rlusdIssuer = issuerWallet.address;
      saveDevnetConfig(config, configPath);
    } else {
      issuerWallet = Wallet.fromSeed(requireField(config, "rlusdIssuerSeed"));
    }

    await enableIssuerDefaultRipple(client, issuerWallet, config);
    await ensureUsdTrustline(client, vendorWallet, issuerWallet.address, "Vendor TrustSet For Mock RLUSD", config);
    await ensureUsdTrustline(client, buyerWallet, issuerWallet.address, "Buyer TrustSet For Mock RLUSD", config);
    await ensureUsdTrustline(client, secondaryWallet, issuerWallet.address, "Secondary TrustSet For Mock RLUSD", config);

    const buyerMinimumUsd = options?.buyerMinimumUsd ?? BUYER_TOP_UP_AMOUNT;
    const secondaryMinimumUsd = options?.secondaryMinimumUsd ?? BUYER_TOP_UP_AMOUNT;

    await ensureMockUsdBalance(client, issuerWallet, buyerWallet, buyerMinimumUsd, "Issuer Funds Buyer With Mock RLUSD", config);
    await ensureMockUsdBalance(client, issuerWallet, secondaryWallet, secondaryMinimumUsd, "Issuer Funds Secondary Holder With Mock RLUSD", config);

    let issuanceId = config.mptIssuanceId;
    const useFreshIssuance =
      options?.rotateIssuance ||
      !issuanceId ||
      !(await issuanceExists(client, issuanceId));

    if (useFreshIssuance) {
      const created = await createMptIssuance(client, vendorWallet, config);
      issuanceId = created.issuanceId;
      config.mptIssuanceId = issuanceId;
      saveDevnetConfig(config, configPath);
    }

    await ensureMptAuthorization(client, buyerWallet, issuanceId, "Buyer Authorizes MPT Receipt", config);
    await ensureMptAuthorization(client, secondaryWallet, issuanceId, "Secondary Holder Authorizes MPT Receipt", config);

    const hookParams = buildHookParamArtifacts(issuerWallet.address, issuanceId);
    const artifactPath = writePrimaryHookArtifact({
      configPath,
      vendorAddress: vendorWallet.address,
      buyerAddress: buyerWallet.address,
      secondaryAddress: secondaryWallet.address,
      issuerAddress: issuerWallet.address,
      issuanceId,
      hookParams
    });

    return {
      client,
      configPath,
      config,
      vendorWallet,
      buyerWallet,
      secondaryWallet,
      issuerWallet,
      issuanceId,
      hookParams,
      artifactPath
    } satisfies PrimaryContext;
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}
