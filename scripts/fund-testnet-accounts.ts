#!/usr/bin/env ts-node

/**
 * Fund Stellar Testnet Accounts
 *
 * This script funds Stellar accounts on the testnet using Friendbot API
 * (free test XLM for testnet accounts).
 *
 * Usage:
 *   ts-node scripts/fund-testnet-accounts.ts <publicKey>
 *   ts-node scripts/fund-testnet-accounts.ts <publicKey1> <publicKey2> ...
 *   ts-node scripts/fund-testnet-accounts.ts --file accounts.txt
 */

import 'dotenv/config';
import { Horizon, StrKey } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

interface FundResult {
  publicKey: string;
  success: boolean;
  method: 'friendbot';
  transactionHash?: string;
  balance?: string;
  error?: string;
}

interface FundOptions {
  publicKeys: string[];
}

/**
 * Fund account using Friendbot (testnet only)
 */
async function fundWithFriendbot(publicKey: string): Promise<FundResult> {
  try {
    // Validate public key
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      return {
        publicKey,
        success: false,
        method: 'friendbot',
        error: 'Invalid Stellar public key format',
      };
    }

    // Friendbot endpoint
    const friendbotUrl = 'https://friendbot.stellar.org';
    const response = await fetch(`${friendbotUrl}?addr=${publicKey}`);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        publicKey,
        success: false,
        method: 'friendbot',
        error: `Friendbot request failed: ${response.status} ${response.statusText} - ${errorText}`,
      };
    }

    const data = await response.json();
    const transactionHash = data.hash || data.transaction_hash;

    // Wait a moment for the transaction to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get account balance
    let balance = '0';
    try {
      const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org');
      const account = await server.loadAccount(publicKey);
      const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');
      balance = nativeBalance ? nativeBalance.balance : '0';
    } catch (error) {
      // Balance check failed, but funding might have succeeded
      console.warn(`⚠️  Could not verify balance for ${publicKey}: ${error instanceof Error ? error.message : error}`);
    }

    return {
      publicKey,
      success: true,
      method: 'friendbot',
      transactionHash,
      balance,
    };
  } catch (error) {
    return {
      publicKey,
      success: false,
      method: 'friendbot',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fund accounts based on options
 */
async function fundAccounts(options: FundOptions): Promise<FundResult[]> {
  const results: FundResult[] = [];

  for (const publicKey of options.publicKeys) {
    console.log(`\n💰 Funding account: ${publicKey}`);
    console.log('   Using Friendbot...');

    const result = await fundWithFriendbot(publicKey);
    results.push(result);

    if (result.success) {
      console.log(`   ✅ Success! Transaction: ${result.transactionHash}`);
      console.log(`   💵 Balance: ${result.balance} XLM`);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }

    // Rate limiting - wait between requests
    if (options.publicKeys.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Parse command line arguments
 */
function parseArguments(): FundOptions {
  const args = process.argv.slice(2);
  const publicKeys: string[] = [];
  let filePath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--file' && i + 1 < args.length) {
      filePath = args[++i];
    } else if (!arg.startsWith('--')) {
      // Assume it's a public key
      publicKeys.push(arg);
    }
  }

  // Read from file if specified
  if (filePath) {
    try {
      const fileContent = fs.readFileSync(path.resolve(filePath), 'utf-8');
      const keys = fileContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && StrKey.isValidEd25519PublicKey(line));
      publicKeys.push(...keys);
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  if (publicKeys.length === 0) {
    console.error('❌ No public keys provided. Usage:');
    console.error('   ts-node scripts/fund-testnet-accounts.ts <publicKey>');
    console.error('   ts-node scripts/fund-testnet-accounts.ts <publicKey1> <publicKey2> ...');
    console.error('   ts-node scripts/fund-testnet-accounts.ts --file accounts.txt');
    console.error('   ts-node scripts/fund-testnet-accounts.ts --amount 100');
    console.error('   ts-node scripts/fund-testnet-accounts.ts --method sponsor');
    process.exit(1);
  }

  return { publicKeys };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🌟 Stellar Testnet Account Funding Script\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Validate environment
    if (!process.env.STELLAR_HORIZON_URL) {
      console.error('❌ Error: STELLAR_HORIZON_URL is not set in environment variables');
      process.exit(1);
    }

    const isTestnet = process.env.STELLAR_HORIZON_URL.includes('testnet') || process.env.STELLAR_NETWORK === 'testnet';
    if (!isTestnet) {
      console.warn('⚠️  Warning: This script is designed for testnet. Current network may not be testnet.');
      console.warn('   STELLAR_HORIZON_URL:', process.env.STELLAR_HORIZON_URL);
    }

    // Parse arguments
    const options = parseArguments();

    console.log(`📋 Configuration:`);
    console.log(`   Network: ${process.env.STELLAR_NETWORK || 'testnet'}`);
    console.log(`   Horizon URL: ${process.env.STELLAR_HORIZON_URL}`);
    console.log(`   Method: Friendbot (testnet only)`);
    console.log(`   Accounts to fund: ${options.publicKeys.length}\n`);

    // Fund accounts
    const results = await fundAccounts(options);

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:\n');

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📝 Total: ${results.length}\n`);

    if (successful.length > 0) {
      console.log('✅ Successfully funded accounts:');
      successful.forEach((result) => {
        console.log(`   ${result.publicKey} - Balance: ${result.balance} XLM - TX: ${result.transactionHash}`);
      });
      console.log('');
    }

    if (failed.length > 0) {
      console.log('❌ Failed accounts:');
      failed.forEach((result) => {
        console.log(`   ${result.publicKey} - Error: ${result.error}`);
      });
      console.log('');
    }

    // Exit with error code if any failed
    if (failed.length > 0) {
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
