#!/usr/bin/env ts-node

/**
 * Change Trust for Stellar Asset
 *
 * This script adds or updates a trustline for a specific asset.
 * The issuer address is hardcoded. The account public key is derived from the provided secret key.
 *
 * Usage:
 *   ts-node scripts/change-trust.ts <assetCode> <secretKey> <network>
 *   ts-node scripts/change-trust.ts <assetCode> <secretKey> <network> --limit 1000000
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

interface ChangeTrustResult {
  success: boolean;
  transactionHash?: string;
  assetCode: string;
  issuerAddress: string;
  accountPublicKey: string;
  limit?: string;
  error?: string;
}

/**
 * Change trust for a specific asset
 */
async function changeTrust(
  assetCode: string,
  secretKey: string,
  network: 'testnet' | 'mainnet',
  limit: string = '922337203685.4775807' // Max limit
): Promise<ChangeTrustResult> {
  let accountPublicKey = '';
  try {
    // Validate inputs
    if (!assetCode || typeof assetCode !== 'string' || assetCode.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey: '',
        error: 'Asset code is required and must be a non-empty string',
      };
    }

    if (!secretKey || typeof secretKey !== 'string' || secretKey.trim().length === 0) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey: '',
        error: 'Secret key is required and must be a non-empty string',
      };
    }

    if (network !== 'testnet' && network !== 'mainnet') {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey: '',
        error: 'Network must be either "testnet" or "mainnet"',
      };
    }

    // Create keypair from secret key and derive account public key
    let accountKeypair: Keypair;
    try {
      accountKeypair = Keypair.fromSecret(secretKey.trim());
      accountPublicKey = accountKeypair.publicKey();
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey: '',
        error: 'Invalid secret key format',
      };
    }

    // Set horizon URL and network passphrase based on network
    const horizonUrl = network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
    const networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;

    // Validate asset code (Stellar asset codes are 1-12 characters, alphanumeric)
    const trimmedAssetCode = assetCode.trim();
    if (trimmedAssetCode.length < 1 || trimmedAssetCode.length > 12) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey,
        error: `Invalid asset code length. Must be 1-12 characters, got ${trimmedAssetCode.length}`,
      };
    }

    // Validate asset code contains only alphanumeric characters
    if (!/^[A-Z0-9]+$/i.test(trimmedAssetCode)) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey,
        error: `Invalid asset code format. Must contain only alphanumeric characters (A-Z, 0-9), got: ${trimmedAssetCode}`,
      };
    }

    // Validate issuer address format
    if (!StrKey.isValidEd25519PublicKey(ISSUER_ADDRESS)) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey,
        error: `Invalid issuer address format: ${ISSUER_ADDRESS}`,
      };
    }

    // Check if account is the same as issuer (issuer cannot trust their own asset)
    if (accountPublicKey === ISSUER_ADDRESS) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey,
        error: `Cannot create trustline: The account (${accountPublicKey}) is the same as the issuer. An issuer cannot create a trustline for their own asset. The issuer can hold their own asset directly without a trustline.`,
      };
    }

    // Create asset object
    let asset: Asset;
    try {
      asset = new Asset(trimmedAssetCode, ISSUER_ADDRESS);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey,
        error: `Failed to create asset object: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Connect to Stellar network
    const server = new Horizon.Server(horizonUrl);

    // Load the account that will add the trustline
    let account;
    try {
      account = await server.loadAccount(accountPublicKey);
    } catch (error) {
      return {
        success: false,
        assetCode,
        issuerAddress: ISSUER_ADDRESS,
        accountPublicKey,
        error: `Failed to load account: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Check if trustline already exists
    const trustlineExists = account.balances.some(
      (balance: any) =>
        balance.asset_type !== 'native' &&
        balance.asset_code === assetCode.trim() &&
        balance.asset_issuer === ISSUER_ADDRESS
    );

    if (trustlineExists) {
      console.log(`⚠️  Trustline already exists for ${assetCode} from ${ISSUER_ADDRESS}`);
      console.log('   Updating trustline with new limit...');
    }

    // Build transaction
    // Use max limit if not provided
    // Max limit in Stellar is 922337203685.4775807 (max int64 / 10^7)
    let trustLimit: string;
    if (limit) {
      // Keep the original string format to preserve precision
      // Validate it's a valid number format (but don't convert to number to avoid precision loss)
      const trimmedLimit = limit.trim();

      // Validate format: must be a positive number with up to 7 decimal places
      // Pattern: one or more digits, optionally followed by a dot and 1-7 decimal digits
      if (!/^\d+(\.\d{1,7})?$/.test(trimmedLimit)) {
        return {
          success: false,
          assetCode,
          issuerAddress: ISSUER_ADDRESS,
          accountPublicKey,
          error: `Invalid trust limit format: ${trimmedLimit}. Must be a positive number with up to 7 decimal places.`,
        };
      }

      // Validate it's a positive number (not zero or negative)
      const limitNum = parseFloat(trimmedLimit);
      if (isNaN(limitNum) || limitNum <= 0) {
        return {
          success: false,
          assetCode,
          issuerAddress: ISSUER_ADDRESS,
          accountPublicKey,
          error: `Invalid trust limit: ${trimmedLimit}. Must be a positive number greater than zero.`,
        };
      }

      trustLimit = trimmedLimit;
    } else {
      // Use max limit - Stellar's maximum trustline limit
      // Format: max int64 (9223372036854775807) divided by 10^7 = 922337203685.4775807
      trustLimit = '922337203685.4775807';
    }

    // Build transaction
    // Note: Don't specify 'source' when it's the same as the transaction source account
    console.log(`   Building transaction for account: ${accountPublicKey}`);
    console.log(`   Asset: ${asset.getCode()} from ${asset.getIssuer()}`);
    console.log(`   Limit: ${trustLimit}`);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset: asset,
          limit: trustLimit,
        })
      )
      .setTimeout(180)
      .build();

    // Sign with the provided secret key
    console.log(`   Signing transaction...`);
    transaction.sign(accountKeypair);

    // Submit transaction
    const result = await server.submitTransaction(transaction);
    const transactionHash = result.hash;

    return {
      success: true,
      transactionHash,
      assetCode: assetCode.trim(),
      issuerAddress: ISSUER_ADDRESS,
      accountPublicKey,
      limit,
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
      accountPublicKey,
      error: errorMessage,
    };
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): {
  assetCode: string;
  secretKey: string;
  network: 'testnet' | 'mainnet';
  limit?: string;
} {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('❌ Error: Missing required arguments');
    console.error('\nUsage:');
    console.error('   ts-node scripts/change-trust.ts <assetCode> <secretKey> <network>');
    console.error('   ts-node scripts/change-trust.ts <assetCode> <secretKey> <network> --limit <limit>');
    console.error('\nParameters:');
    console.error('   assetCode - The asset code (e.g., "SYTE")');
    console.error('   secretKey - The secret key of the account adding the trustline');
    console.error('   network   - Either "testnet" or "mainnet"');
    console.error('   --limit   - (Optional) Trust limit (default: max)');
    console.error('\nExample:');
    console.error('   ts-node scripts/change-trust.ts SYTE S... testnet');
    console.error('   ts-node scripts/change-trust.ts SYTE S... mainnet --limit 1000000');
    process.exit(1);
  }

  const assetCode = args[0];
  const secretKey = args[1];
  const networkArg = args[2].toLowerCase();

  if (networkArg !== 'testnet' && networkArg !== 'mainnet') {
    console.error(`❌ Error: Invalid network "${networkArg}". Must be "testnet" or "mainnet"`);
    process.exit(1);
  }

  const network = networkArg as 'testnet' | 'mainnet';
  let limit: string | undefined;

  // Parse optional limit
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--limit' && i + 1 < args.length) {
      limit = args[++i];
    }
  }

  return { assetCode, secretKey, network, limit };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🔐 Stellar Change Trust Script\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Parse arguments
    const { assetCode, secretKey, network, limit } = parseArguments();

    console.log(`📋 Configuration:`);
    console.log(`   Network: ${network}`);
    console.log(
      `   Horizon URL: ${network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'}`
    );
    console.log(`   Issuer Address: ${ISSUER_ADDRESS}`);
    console.log(`   Asset Code: ${assetCode}`);
    console.log(`   Trust Limit: ${limit || '922337203685.4775807 (max)'}`);
    console.log('');

    // Change trust
    console.log(`🔗 Changing trust for ${assetCode}...`);
    const result = await changeTrust(assetCode, secretKey, network, limit);

    if (result.success) {
      console.log(`\n✅ Trustline added/updated successfully!`);
      console.log(`   Transaction Hash: ${result.transactionHash}`);
      console.log(`   Asset: ${result.assetCode}`);
      console.log(`   Issuer: ${result.issuerAddress}`);
      console.log(`   Account: ${result.accountPublicKey}`);
      console.log(`   Limit: ${result.limit}`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Output JSON for programmatic use
      console.log('JSON Output:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    } else {
      console.error(`\n❌ Failed to change trust:`);
      console.error(`   Error: ${result.error}`);
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Common error messages
      if (result.error?.includes('op_underfunded')) {
        console.error('💡 Tip: Account has insufficient funds to pay transaction fees');
      } else if (result.error?.includes('op_no_trust')) {
        console.error('💡 Tip: Trustline operation failed - check account and asset details');
      } else if (result.error?.includes('op_line_full')) {
        console.error('💡 Tip: Trustline limit reached - increase the limit or remove existing trustline');
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
