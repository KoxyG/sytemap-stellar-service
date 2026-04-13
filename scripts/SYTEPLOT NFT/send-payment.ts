#!/usr/bin/env ts-node

/**
 * Send Payment Script
 *
 * This script sends a payment of SYTEPLOT NFTs to a destination/distributor account.
 * Addresses are read from environment variables:
 *   - Issuer address: SYTEPLOT_ISSUER_ADDRESS
 *   - Destination/distributor: SYTE_DISTRIBUTOR_ADDRESS
 *   - Issuer private key: SYTEPLOT_ISSUER_PRIVATE_KEY (fallback: SPONSOR_PRIVATE_KEY)
 *   - Network: STELLAR_NETWORK (testnet/mainnet)
 *   - Asset code: SYTEPLOT_ASSET_CODE
 *   - Amount is hardcoded to Stellar max issued-asset amount
 *
 * The transaction is signed with the issuer's secret key.
 *
 * Usage:
 *   ts-node scripts/SYTEPLOT\ NFT/send-payment.ts
 */

import 'dotenv/config';
import {
  Keypair,
  Horizon,
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
  StrKey,
  Asset,
} from '@stellar/stellar-sdk';

// Stellar max issued-asset amount for one payment/trustline
const MAX_PAYMENT_AMOUNT = '922337203685.4775807';

interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  assetCode: string;
  issuerAddress: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: string;
  maxReceivable?: string;
  error?: string;
}

/**
 * Send payment to destination account
 */
async function sendPayment(
  issuerAddress: string,
  assetCode: string,
  destinationAccount: string,
  issuerSecretKey: string,
  network: 'testnet' | 'mainnet',
  paymentAmount: string
): Promise<PaymentResult> {
  let sourceAccount = '';
  try {
    // Validate inputs
    if (!assetCode || typeof assetCode !== 'string' || assetCode.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount: '',
        destinationAccount,
        amount: paymentAmount,
        error: 'Asset code is required and must be a non-empty string',
      };
    }

    if (!destinationAccount || typeof destinationAccount !== 'string' || destinationAccount.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount: '',
        destinationAccount: '',
        amount: paymentAmount,
        error: 'Destination account is required and must be a non-empty string',
      };
    }

    if (!issuerSecretKey || typeof issuerSecretKey !== 'string' || issuerSecretKey.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount: '',
        destinationAccount,
        amount: paymentAmount,
        error: 'Issuer secret key is required and must be a non-empty string',
      };
    }

    if (network !== 'testnet' && network !== 'mainnet') {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount: '',
        destinationAccount,
        amount: paymentAmount,
        error: 'Network must be either "testnet" or "mainnet"',
      };
    }

    // Validate destination account format
    const trimmedDestination = destinationAccount.trim();
    if (!StrKey.isValidEd25519PublicKey(trimmedDestination)) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount: '',
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error:
          'Invalid destination account format. Must be a valid Stellar public key (starts with G and is 56 characters long).',
      };
    }

    // Create keypair from issuer secret key and derive source account
    let issuerKeypair: Keypair;
    try {
      issuerKeypair = Keypair.fromSecret(issuerSecretKey.trim());
      sourceAccount = issuerKeypair.publicKey();
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount: '',
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: 'Invalid issuer secret key format',
      };
    }

    // Verify the secret key matches issuer address from env
    if (sourceAccount !== issuerAddress) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Secret key does not match issuer address. Expected: ${issuerAddress}, Got: ${sourceAccount}`,
      };
    }

    // Validate asset code (Stellar asset codes are 1-12 characters, alphanumeric)
    const trimmedAssetCode = assetCode.trim();
    if (trimmedAssetCode.length < 1 || trimmedAssetCode.length > 12) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Invalid asset code length. Must be 1-12 characters, got ${trimmedAssetCode.length}`,
      };
    }

    // Validate asset code contains only alphanumeric characters
    if (!/^[A-Z0-9]+$/i.test(trimmedAssetCode)) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Invalid asset code format. Must contain only alphanumeric characters (A-Z, 0-9), got: ${trimmedAssetCode}`,
      };
    }

    const parsedAmount = Number(paymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Invalid payment amount "${paymentAmount}". Must be a positive number.`,
      };
    }

    // Set horizon URL and network passphrase based on network
    const horizonUrl = network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
    const networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;

    // Create asset object
    let asset: Asset;
    try {
      asset = new Asset(trimmedAssetCode, issuerAddress);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Failed to create asset object: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Connect to Stellar network
    const server = new Horizon.Server(horizonUrl);

    // Load the source account (issuer)
    let sourceAccountObj;
    try {
      sourceAccountObj = await server.loadAccount(sourceAccount);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Failed to load source account: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Check if destination account exists
    let destinationAccountObj;
    try {
      destinationAccountObj = await server.loadAccount(trimmedDestination);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Destination account does not exist: ${trimmedDestination}`,
      };
    }

    // Pre-check destination trustline remaining capacity to avoid op_line_full on submit
    const trustline = destinationAccountObj.balances.find((balance: any) => {
      return balance.asset_type !== 'native' && balance.asset_code === trimmedAssetCode && balance.asset_issuer === issuerAddress;
    });

    if (!trustline || trustline.asset_type === 'native' || !('limit' in trustline)) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        error: `Destination trustline not found for ${trimmedAssetCode}:${issuerAddress}`,
      };
    }

    const trustlineLimit = Number(trustline.limit);
    const trustlineBalance = Number(trustline.balance);
    const remainingCapacity = trustlineLimit - trustlineBalance;
    const maxReceivable = remainingCapacity.toFixed(7);
    if (remainingCapacity <= 0) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        maxReceivable,
        error: `Destination trustline is already full. Remaining capacity is ${maxReceivable}.`,
      };
    }

    if (parsedAmount > remainingCapacity) {
      return {
        success: false,
        assetCode,
        issuerAddress,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: paymentAmount,
        maxReceivable,
        error: `Requested amount ${paymentAmount} exceeds trustline remaining capacity ${maxReceivable}.`,
      };
    }

    const txAmount = parsedAmount.toFixed(7);

    // With current API flow, 1 token is treated as 1 NFT on-chain
    const nftCount = Math.floor(parsedAmount);

    // Build transaction
    console.log(`   Building payment transaction...`);
    console.log(`   Source: ${sourceAccount}`);
    console.log(`   Destination: ${trimmedDestination}`);
    console.log(`   Asset: ${asset.getCode()} from ${asset.getIssuer()}`);
    console.log(`   Amount: ${txAmount} tokens`);
    console.log(`   NFTs: ${nftCount.toLocaleString()} NFTs`);

    const transaction = new TransactionBuilder(sourceAccountObj, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: trimmedDestination,
          asset: asset,
          amount: txAmount,
        })
      )
      .setTimeout(180)
      .build();

    // Sign with issuer's secret key
    console.log(`   Signing transaction with issuer key...`);
    transaction.sign(issuerKeypair);

    // Submit transaction
    console.log(`   Submitting transaction...`);
    const result = await server.submitTransaction(transaction);
    const transactionHash = result.hash;

    return {
      success: true,
      transactionHash,
      assetCode: trimmedAssetCode,
      issuerAddress,
      sourceAccount,
      destinationAccount: trimmedDestination,
      amount: txAmount,
    };
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : String(error);

    // Parse Stellar-specific errors
    if (error instanceof Error && 'response' in error) {
      const stellarError = error as any;
      if (stellarError.response?.data) {
        const data = stellarError.response.data;
        if (data.extras?.result_codes) {
          errorMessage = `Stellar error: ${JSON.stringify(data.extras.result_codes)}`;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.title) {
          errorMessage = `${data.title}: ${data.detail || errorMessage}`;
        }
      }
    }

    return {
      success: false,
      assetCode,
      issuerAddress,
      sourceAccount,
      destinationAccount,
      amount: paymentAmount,
      error: errorMessage,
    };
  }
}

/**
 * Parse command line arguments
 */
function parseConfig(): {
  issuerAddress: string;
  assetCode: string;
  destinationAccount: string;
  issuerSecretKey: string;
  network: 'testnet' | 'mainnet';
  paymentAmount: string;
} {
  const cliAmountArg = process.argv.find((arg) => arg.startsWith('--amount='));
  const cliAmount = cliAmountArg ? cliAmountArg.replace('--amount=', '').trim() : '';
  const issuerAddress = (process.env.SYTEPLOT_ISSUER_ADDRESS || '').trim();
  const destinationAccount = (process.env.SYTE_DISTRIBUTOR_ADDRESS || '').trim();
  const issuerSecretKey = ((process.env.SYTEPLOT_ISSUER_PRIVATE_KEY || process.env.SPONSOR_PRIVATE_KEY) || '').trim();
  const assetCode = (process.env.SYTEPLOT_ASSET_CODE || '').trim();
  const network = ((process.env.STELLAR_NETWORK || 'testnet').toLowerCase() as 'testnet' | 'mainnet');
  const paymentAmount = (cliAmount || process.env.SYTEPLOT_PAYMENT_AMOUNT || process.env.PAYMENT_AMOUNT || MAX_PAYMENT_AMOUNT).trim();

  if (!issuerAddress || !destinationAccount || !issuerSecretKey || !assetCode) {
    console.error('❌ Error: Missing required environment variables.');
    console.error('\nRequired:');
    console.error('   SYTEPLOT_ISSUER_ADDRESS');
    console.error('   SYTE_DISTRIBUTOR_ADDRESS');
    console.error('   SYTEPLOT_ASSET_CODE');
    console.error('   SYTEPLOT_ISSUER_PRIVATE_KEY (or SPONSOR_PRIVATE_KEY fallback)');
    console.error('   STELLAR_NETWORK (testnet/mainnet)');
    process.exit(1);
  }
  if (network !== 'testnet' && network !== 'mainnet') {
    console.error(`❌ Error: Invalid STELLAR_NETWORK "${network}". Must be "testnet" or "mainnet"`);
    process.exit(1);
  }

  return { issuerAddress, assetCode, destinationAccount, issuerSecretKey, network, paymentAmount };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n💸 Stellar Payment Script\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Parse environment configuration
    const { issuerAddress, assetCode, destinationAccount, issuerSecretKey, network, paymentAmount } = parseConfig();
    const nftCount = Math.floor(parseFloat(paymentAmount));

    console.log(`📋 Configuration:`);
    console.log(`   Network: ${network}`);
    console.log(
      `   Horizon URL: ${network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'}`
    );
    console.log(`   Issuer Address: ${issuerAddress}`);
    console.log(`   Asset Code: ${assetCode}`);
    console.log(`   Destination Account: ${destinationAccount}`);
    console.log(`   Amount: ${paymentAmount} tokens`);
    console.log(`   NFTs: ${nftCount.toLocaleString()} NFTs`);
    console.log('');

    // Send payment
    console.log(`💸 Sending payment...`);
    const result = await sendPayment(issuerAddress, assetCode, destinationAccount, issuerSecretKey, network, paymentAmount);

    if (result.success) {
      console.log(`\n✅ Payment sent successfully!`);
      console.log(`   Transaction Hash: ${result.transactionHash}`);
      console.log(`   Asset: ${result.assetCode}`);
      console.log(`   Issuer: ${result.issuerAddress}`);
      console.log(`   Source Account: ${result.sourceAccount}`);
      console.log(`   Destination Account: ${result.destinationAccount}`);
      console.log(`   Amount: ${result.amount} tokens`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Output JSON for programmatic use
      console.log('JSON Output:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    } else {
      console.error(`\n❌ Failed to send payment:`);
      console.error(`   Error: ${result.error}`);
      if (result.maxReceivable) {
        console.error(`   Max receivable now: ${result.maxReceivable}`);
      }
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Common error messages
      if (result.error?.includes('op_underfunded')) {
        console.error('💡 Tip: Source account has insufficient funds to pay transaction fees');
      } else if (result.error?.includes('op_no_trust')) {
        console.error('💡 Tip: Destination account does not have a trustline for this asset');
      } else if (result.error?.includes('op_line_full')) {
        console.error('💡 Tip: Destination account trustline limit reached');
      } else if (result.error?.includes('op_no_account')) {
        console.error('💡 Tip: Destination account does not exist on the network');
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();
