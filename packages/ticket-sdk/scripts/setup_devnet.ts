import { Client, MPTokenIssuanceCreate, MPTokenIssuanceCreateFlags, TrustSet, Payment } from 'xrpl'

const DEVNET_URL = 'wss://s.devnet.rippletest.net:51233'

async function setupDevnet() {
  const client = new Client(DEVNET_URL)
  await client.connect()

  try {
    console.log('--- Funding Wallets via Faucet ---')
    
    // Generate and Fund Core Wallets
    const { wallet: VenueWallet } = await client.fundWallet()
    const { wallet: AliceWallet } = await client.fundWallet()
    const { wallet: BobWallet } = await client.fundWallet()
    const { wallet: DaveWallet } = await client.fundWallet()
    const { wallet: ScalperWallet } = await client.fundWallet()
    
    // Dummy Issuer for RLUSD
    const { wallet: IssuerWallet } = await client.fundWallet()

    console.log(`VenueWallet (Issuer):`)
    console.log(`  Address: ${VenueWallet.address}`)
    console.log(`  Seed:    ${VenueWallet.seed}\n`)

    console.log(`AliceWallet:`)
    console.log(`  Address: ${AliceWallet.address}`)
    console.log(`  Seed:    ${AliceWallet.seed}\n`)

    // 1. Issue the MPT (Multi-Purpose Token)
    console.log('--- Creating MPT Issuance ---')
    const mptIssuance: MPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: VenueWallet.address,
      AssetScale: 0, // Tickets are usually whole units
      TransferFee: 0,
      Flags: MPTokenIssuanceCreateFlags.tfMPTCanLock, // lsfMPTokenFreeze equivalent in tx flag
      MPTokenMetadata: Buffer.from('General Admission').toString('hex'), 
    }

    const preparedMPT = await client.autofill(mptIssuance)
    const signedMPT = VenueWallet.sign(preparedMPT)
    const resultMPT = await client.submitAndWait(signedMPT.tx_blob)

    const affectedNodes = resultMPT.result.meta as any
    const mptNode = affectedNodes.AffectedNodes.find(
      (node: any) => node.CreatedNode?.LedgerEntryType === 'MPTokenIssuance'
    )
    const assetID = mptNode?.CreatedNode?.LedgerIndex || 'Not Found'
    
    // 2. Issue RLUSD (Stablecoin)
    console.log('--- Issuing RLUSD ---')
    const walletsToFund = [VenueWallet, AliceWallet, BobWallet, DaveWallet, ScalperWallet];
    
    for (const wallet of walletsToFund) {
      // Create Trustline for RLUSD
      const trustSetTx: TrustSet = {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: {
          currency: "USD",
          issuer: IssuerWallet.address,
          value: "10000" // Limit
        }
      };
      const preparedTrust = await client.autofill(trustSetTx);
      const signedTrust = wallet.sign(preparedTrust);
      await client.submitAndWait(signedTrust.tx_blob);

      // Send RLUSD to Wallet
      const paymentTx: Payment = {
        TransactionType: "Payment",
        Account: IssuerWallet.address,
        Destination: wallet.address,
        Amount: {
          currency: "USD",
          issuer: IssuerWallet.address,
          value: "1000" // Mint 1000 RLUSD to each
        }
      };
      const preparedPayment = await client.autofill(paymentTx);
      const signedPayment = IssuerWallet.sign(preparedPayment);
      await client.submitAndWait(signedPayment.tx_blob);
    }
    console.log('Successfully minted and distributed 1000 RLUSD to test wallets.')

    console.log('\n--- Task Complete ---')
    console.log(`MPT AssetID: ${assetID}\n`)
    console.log('Copy-paste the following for the dev team:')
    console.log(`VENUE_ADDRESS=${VenueWallet.address}`)
    console.log(`VENUE_SEED=${VenueWallet.seed}`)
    console.log(`ALICE_ADDRESS=${AliceWallet.address}`)
    console.log(`ALICE_SEED=${AliceWallet.seed}`)
    console.log(`BOB_ADDRESS=${BobWallet.address}`)
    console.log(`BOB_SEED=${BobWallet.seed}`)
    console.log(`DAVE_ADDRESS=${DaveWallet.address}`)
    console.log(`DAVE_SEED=${DaveWallet.seed}`)
    console.log(`SCALPER_ADDRESS=${ScalperWallet.address}`)
    console.log(`SCALPER_SEED=${ScalperWallet.seed}`)
    console.log(`MPT_ASSET_ID=${assetID}`)
    console.log(`RLUSD_ISSUER=${IssuerWallet.address}`)

  } catch (error) {
    console.error('Error setting up Devnet:', error)
  } finally {
    await client.disconnect()
  }
}

setupDevnet()
