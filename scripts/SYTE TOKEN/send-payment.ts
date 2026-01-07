#!/usr/bin/env ts-node

/**
 * Send Payment Script
 *
 * This script sends a payment of a custom asset to a destination/distributor account.
 * The issuer address is hardcoded, and the amount is hardcoded to 1 million tokens.
 * The transaction is signed with the issuer's secret key.
 *
 * Usage:
 *   ts-node scripts/send-payment.ts <assetCode> <destinationAccount> <issuerSecretKey> <network>
 *
 * Network options: testnet or mainnet
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

// Hardcoded issuer address
const ISSUER_ADDRESS = 'GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC';

// Hardcoded amount: 1 million tokens
const PAYMENT_AMOUNT = '1000000';

interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  assetCode: string;
  issuerAddress: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: string;
  error?: string;
}

/**
 * Send payment to destination account
 */
async function sendPayment(
  assetCode: string,
  destinationAccount: string,
  issuerSecretKey: string,
  network: 'testnet' | 'mainnet'
): Promise<PaymentResult> {
  let sourceAccount = '';
  try {
    // Validate inputs
    if (!assetCode || typeof assetCode !== 'string' || assetCode.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount: '',
        destinationAccount,
        amount: PAYMENT_AMOUNT,
        error: 'Asset code is required and must be a non-empty string',
      };
    }

    if (!destinationAccount || typeof destinationAccount !== 'string' || destinationAccount.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount: '',
        destinationAccount: '',
        amount: PAYMENT_AMOUNT,
        error: 'Destination account is required and must be a non-empty string',
      };
    }

    if (!issuerSecretKey || typeof issuerSecretKey !== 'string' || issuerSecretKey.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount: '',
        destinationAccount,
        amount: PAYMENT_AMOUNT,
        error: 'Issuer secret key is required and must be a non-empty string',
      };
    }

    if (network !== 'testnet' && network !== 'mainnet') {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount: '',
        destinationAccount,
        amount: PAYMENT_AMOUNT,
        error: 'Network must be either "testnet" or "mainnet"',
      };
    }

    // Validate destination account format
    const trimmedDestination = destinationAccount.trim();
    if (!StrKey.isValidEd25519PublicKey(trimmedDestination)) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount: '',
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
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
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount: '',
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
        error: 'Invalid issuer secret key format',
      };
    }

    // Verify the secret key matches the hardcoded issuer address
    if (sourceAccount !== ISSUER_ADDRESS) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
        error: `Secret key does not match issuer address. Expected: ${ISSUER_ADDRESS}, Got: ${sourceAccount}`,
      };
    }

    // Validate asset code (Stellar asset codes are 1-12 characters, alphanumeric)
    const trimmedAssetCode = assetCode.trim();
    if (trimmedAssetCode.length < 1 || trimmedAssetCode.length > 12) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
        error: `Invalid asset code length. Must be 1-12 characters, got ${trimmedAssetCode.length}`,
      };
    }

    // Validate asset code contains only alphanumeric characters
    if (!/^[A-Z0-9]+$/i.test(trimmedAssetCode)) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
        error: `Invalid asset code format. Must contain only alphanumeric characters (A-Z, 0-9), got: ${trimmedAssetCode}`,
      };
    }

    // Set horizon URL and network passphrase based on network
    const horizonUrl = network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
    const networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;

    // Create asset object
    let asset: Asset;
    try {
      asset = new Asset(trimmedAssetCode, ISSUER_ADDRESS);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
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
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
        error: `Failed to load source account: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Check if destination account exists
    try {
      await server.loadAccount(trimmedDestination);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        sourceAccount,
        destinationAccount: trimmedDestination,
        amount: PAYMENT_AMOUNT,
        error: `Destination account does not exist: ${trimmedDestination}`,
      };
    }

    // Build transaction
    console.log(`   Building payment transaction...`);
    console.log(`   Source: ${sourceAccount}`);
    console.log(`   Destination: ${trimmedDestination}`);
    console.log(`   Asset: ${asset.getCode()} from ${asset.getIssuer()}`);
    console.log(`   Amount: ${PAYMENT_AMOUNT}`);

    const transaction = new TransactionBuilder(sourceAccountObj, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: trimmedDestination,
          asset: asset,
          amount: PAYMENT_AMOUNT,
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
      issuerAddress: ISSUER_ADDRESS,
      sourceAccount,
      destinationAccount: trimmedDestination,
      amount: PAYMENT_AMOUNT,
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
      issuerAddress: ISSUER_ADDRESS,
      sourceAccount,
      destinationAccount,
      amount: PAYMENT_AMOUNT,
      error: errorMessage,
    };
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): {
  assetCode: string;
  destinationAccount: string;
  issuerSecretKey: string;
  network: 'testnet' | 'mainnet';
} {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.error('❌ Error: Missing required arguments');
    console.error('\nUsage:');
    console.error('   ts-node scripts/send-payment.ts <assetCode> <destinationAccount> <issuerSecretKey> <network>');
    console.error('\nParameters:');
    console.error('   assetCode         - The asset code (e.g., "SYTE")');
    console.error('   destinationAccount - The destination/distributor account public key');
    console.error("   issuerSecretKey   - The issuer's secret key for signing");
    console.error('   network           - Either "testnet" or "mainnet"');
    console.error('\nExample:');
    console.error('   ts-node scripts/send-payment.ts SYTE GABC123... S... testnet');
    process.exit(1);
  }

  const assetCode = args[0];
  const destinationAccount = args[1];
  const issuerSecretKey = args[2];
  const networkArg = args[3].toLowerCase();

  if (networkArg !== 'testnet' && networkArg !== 'mainnet') {
    console.error(`❌ Error: Invalid network "${networkArg}". Must be "testnet" or "mainnet"`);
    process.exit(1);
  }

  const network = networkArg as 'testnet' | 'mainnet';

  return { assetCode, destinationAccount, issuerSecretKey, network };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n💸 Stellar Payment Script\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Parse arguments
    const { assetCode, destinationAccount, issuerSecretKey, network } = parseArguments();

    console.log(`📋 Configuration:`);
    console.log(`   Network: ${network}`);
    console.log(
      `   Horizon URL: ${network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'}`
    );
    console.log(`   Issuer Address: ${ISSUER_ADDRESS}`);
    console.log(`   Asset Code: ${assetCode}`);
    console.log(`   Destination Account: ${destinationAccount}`);
    console.log(`   Amount: ${PAYMENT_AMOUNT} tokens (hardcoded)`);
    console.log('');

    // Send payment
    console.log(`💸 Sending payment...`);
    const result = await sendPayment(assetCode, destinationAccount, issuerSecretKey, network);

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
