#!/usr/bin/env ts-node

/**
 * Set Authorization Flags Script
 *
 * This script sets authorization flags on the issuing account.
 * The flags enable revocable and clawback features.
 * The transaction is signed with the issuer's secret key.
 *
 * Usage:
 *   ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> <network>
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
  AuthRevocableFlag,
  AuthClawbackEnabledFlag,
} from '@stellar/stellar-sdk';

// Hardcoded issuer address
const ISSUER_ADDRESS = 'GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC';

interface SetAuthorizationFlagsResult {
  success: boolean;
  transactionHash?: string;
  issuerAddress: string;
  flags: {
    authRevocable: boolean;
    authClawbackEnabled: boolean;
  };
  error?: string;
}

/**
 * Set authorization flags for issuer account
 */
async function setAuthorizationFlags(
  issuerSecretKey: string,
  network: 'testnet' | 'mainnet'
): Promise<SetAuthorizationFlagsResult> {
  try {
    // Validate inputs
    if (!issuerSecretKey || typeof issuerSecretKey !== 'string' || issuerSecretKey.trim().length === 0) {
      return {
        success: false,
        issuerAddress: ISSUER_ADDRESS,
        flags: {
          authRevocable: true,
          authClawbackEnabled: true,
        },
        error: 'Issuer secret key is required and must be a non-empty string',
      };
    }

    if (network !== 'testnet' && network !== 'mainnet') {
      return {
        success: false,
        issuerAddress: ISSUER_ADDRESS,
        flags: {
          authRevocable: true,
          authClawbackEnabled: true,
        },
        error: 'Network must be either "testnet" or "mainnet"',
      };
    }

    // Create keypair from issuer secret key
    let issuerKeypair: Keypair;
    let derivedIssuerAddress: string;
    try {
      issuerKeypair = Keypair.fromSecret(issuerSecretKey.trim());
      derivedIssuerAddress = issuerKeypair.publicKey();
    } catch (error) {
      return {
        success: false,
        issuerAddress: ISSUER_ADDRESS,
        flags: {
          authRevocable: true,
          authClawbackEnabled: true,
        },
        error: 'Invalid issuer secret key format',
      };
    }

    // Verify the secret key matches the hardcoded issuer address
    if (derivedIssuerAddress !== ISSUER_ADDRESS) {
      return {
        success: false,
        issuerAddress: ISSUER_ADDRESS,
        flags: {
          authRevocable: true,
          authClawbackEnabled: true,
        },
        error: `Secret key does not match issuer address. Expected: ${ISSUER_ADDRESS}, Got: ${derivedIssuerAddress}`,
      };
    }

    // Set horizon URL and network passphrase based on network
    const horizonUrl = network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
    const networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;

    // Connect to Stellar network
    const server = new Horizon.Server(horizonUrl);

    // Load the issuer account
    let account;
    try {
      account = await server.loadAccount(derivedIssuerAddress);
    } catch (error) {
      return {
        success: false,
        issuerAddress: ISSUER_ADDRESS,
        flags: {
          authRevocable: true,
          authClawbackEnabled: true,
        },
        error: `Failed to load issuer account: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Calculate the flags to set (combine using bitwise OR)
    const flagsToSet: number = AuthRevocableFlag | AuthClawbackEnabledFlag;

    // Check current flags
    const currentFlags = account.flags;
    const currentAuthRevocable = (currentFlags.auth_revocable || false) as boolean;
    const currentAuthClawbackEnabled = (currentFlags.auth_clawback_enabled || false) as boolean;

    // Check if flags are already set
    if (currentAuthRevocable && currentAuthClawbackEnabled) {
      console.log(`⚠️  Authorization flags are already set correctly`);
      console.log(`   Auth Revocable: ${currentAuthRevocable}`);
      console.log(`   Auth Clawback Enabled: ${currentAuthClawbackEnabled}`);
      return {
        success: true,
        issuerAddress: ISSUER_ADDRESS,
        flags: {
          authRevocable: currentAuthRevocable,
          authClawbackEnabled: currentAuthClawbackEnabled,
        },
        error: 'Authorization flags are already set correctly',
      };
    }

    // Build transaction
    console.log(`   Building transaction to set authorization flags...`);
    console.log(`   Issuer Account: ${derivedIssuerAddress}`);
    console.log(`   Current Flags:`);
    console.log(`     Auth Revocable: ${currentAuthRevocable}`);
    console.log(`     Auth Clawback Enabled: ${currentAuthClawbackEnabled}`);
    console.log(`   Setting Flags:`);
    console.log(`     Auth Revocable: true`);
    console.log(`     Auth Clawback Enabled: true`);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.setOptions({
          setFlags: flagsToSet as any, // Combined flags as number
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
      issuerAddress: ISSUER_ADDRESS,
      flags: {
        authRevocable: true,
        authClawbackEnabled: true,
      },
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
      issuerAddress: ISSUER_ADDRESS,
      flags: {
        authRevocable: true,
        authClawbackEnabled: true,
      },
      error: errorMessage,
    };
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): {
  issuerSecretKey: string;
  network: 'testnet' | 'mainnet';
} {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Error: Missing required arguments');
    console.error('\nUsage:');
    console.error('   ts-node scripts/SYTEPLOT\\ NFT/set-authorization-flags.ts <issuerSecretKey> <network>');
    console.error('\nParameters:');
    console.error("   issuerSecretKey - The issuer's secret key for signing");
    console.error('   network         - Either "testnet" or "mainnet"');
    console.error('\nExample:');
    console.error('   ts-node scripts/SYTEPLOT\\ NFT/set-authorization-flags.ts S... testnet');
    console.error('   ts-node scripts/SYTEPLOT\\ NFT/set-authorization-flags.ts S... mainnet');
    process.exit(1);
  }

  const issuerSecretKey = args[0];
  const networkArg = args[1].toLowerCase();

  if (networkArg !== 'testnet' && networkArg !== 'mainnet') {
    console.error(`❌ Error: Invalid network "${networkArg}". Must be "testnet" or "mainnet"`);
    process.exit(1);
  }

  const network = networkArg as 'testnet' | 'mainnet';

  return { issuerSecretKey, network };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🔐 Stellar Set Authorization Flags Script\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Parse arguments
    const { issuerSecretKey, network } = parseArguments();

    console.log(`📋 Configuration:`);
    console.log(`   Network: ${network}`);
    console.log(
      `   Horizon URL: ${network === 'testnet' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'}`
    );
    console.log(`   Issuer Address: ${ISSUER_ADDRESS}`);
    console.log(`   Flags to Set:`);
    console.log(`     - Auth Revocable: true`);
    console.log(`     - Auth Clawback Enabled: true`);
    console.log('');

    // Set authorization flags
    console.log(`🔐 Setting authorization flags...`);
    const result = await setAuthorizationFlags(issuerSecretKey, network);

    if (result.success) {
      if (result.error && result.error.includes('already set')) {
        console.log(`\n✅ ${result.error}`);
      } else {
        console.log(`\n✅ Authorization flags set successfully!`);
        console.log(`   Transaction Hash: ${result.transactionHash}`);
        console.log(`   Issuer Address: ${result.issuerAddress}`);
        console.log(`   Flags Set:`);
        console.log(`     Auth Revocable: ${result.flags.authRevocable}`);
        console.log(`     Auth Clawback Enabled: ${result.flags.authClawbackEnabled}`);
      }
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Output JSON for programmatic use
      console.log('JSON Output:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    } else {
      console.error(`\n❌ Failed to set authorization flags:`);
      console.error(`   Error: ${result.error}`);
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Common error messages
      if (result.error?.includes('op_underfunded')) {
        console.error('💡 Tip: Issuer account has insufficient funds to pay transaction fees');
      } else if (result.error?.includes('op_bad_auth')) {
        console.error('💡 Tip: Transaction authorization failed - check secret key');
      } else if (result.error?.includes('tx_bad_seq')) {
        console.error('💡 Tip: Sequence number error - please retry');
      } else if (result.error?.includes('ENOTFOUND')) {
        console.error('💡 Tip: Network connection error - check your internet connection');
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
