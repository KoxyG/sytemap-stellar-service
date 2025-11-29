#!/usr/bin/env ts-node

/**
 * Create and Encrypt Stellar Account
 *
 * This script creates a new Stellar account on the network and encrypts the secret key,
 * returning only the wallet address and encrypted secret key.
 *
 * Usage:
 *   ts-node scripts/create-and-encrypt-account.ts
 */

import 'dotenv/config';
import { Keypair, Horizon, BASE_FEE, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import StellarHDWallet from 'stellar-hd-wallet';
import encryptionService from '../src/encryption/encryption.service';

async function createAndEncryptAccount() {
  try {
    console.log('\n🔐 Creating Stellar Account and Encrypting Secret Key...\n');

    // Validate environment variables
    if (!process.env.STELLAR_HORIZON_URL) {
      console.error('❌ Error: STELLAR_HORIZON_URL is not set in environment variables');
      process.exit(1);
    }

    const sponsorPubKey = process.env.SPONSOR_PUBLIC_KEY;
    if (!sponsorPubKey) {
      console.error('❌ Error: SPONSOR_PUBLIC_KEY is not set in environment variables');
      process.exit(1);
    }

    if (!process.env.SPONSOR_PRIVATE_KEY) {
      console.error('❌ Error: SPONSOR_PRIVATE_KEY is not set in environment variables');
      process.exit(1);
    }

    // Generate mnemonic phrase
    console.log('📝 Generating mnemonic phrase...');
    const mnemonic = StellarHDWallet.generateMnemonic();
    const wallet = StellarHDWallet.fromMnemonic(mnemonic);
    const keypair = wallet.getKeypair(0);

    // Get public and secret keys
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    console.log(`✅ Generated keypair: ${publicKey}\n`);

    // Create account on Stellar network
    console.log('🌐 Creating account on Stellar network...');
    const networkPassphrase = process.env.NODE_ENV === 'production' ? Networks.PUBLIC : Networks.TESTNET;
    const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
    const sourceAccount = await server.loadAccount(sponsorPubKey);
    const sponsorKeypair = Keypair.fromSecret(process.env.SPONSOR_PRIVATE_KEY);

    // Build sponsored transaction
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.beginSponsoringFutureReserves({
          sponsoredId: publicKey,
        })
      )
      .addOperation(
        Operation.createAccount({
          destination: publicKey,
          startingBalance: '0',
        })
      )
      .addOperation(
        Operation.endSponsoringFutureReserves({
          source: publicKey,
        })
      )
      .setTimeout(180)
      .build();

    // Sign with both sponsor and new account
    transaction.sign(sponsorKeypair);
    transaction.sign(keypair);

    // Submit transaction
    const result = await server.submitTransaction(transaction);
    const transactionHash = result.hash;
    console.log(`✅ Account created successfully on Stellar network!`);
    console.log(`   Transaction Hash: ${transactionHash}\n`);

    // Encrypt the secret key
    console.log('🔒 Encrypting secret key...');
    const encryptedSecretKey = await encryptionService.encryptSecretKey(secretKey);
    console.log('✅ Secret key encrypted successfully!\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Account Details:\n');
    console.log(`WalletAddress: ${publicKey}`);
    console.log(`EncryptedSecretKey: ${encryptedSecretKey}`);
    console.log(`TransactionHash: ${transactionHash}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Store the encrypted secret key securely');
    console.log('   2. The plain secret key is: ' + secretKey);
    console.log('   3. Keep the mnemonic phrase safe for recovery');
    console.log('   4. Never commit secret keys to version control');
    console.log('\n');

    // Return only wallet address and encrypted key as JSON
    const resultData = {
      WalletAddress: publicKey,
      EncryptedSecretKey: encryptedSecretKey,
      TransactionHash: transactionHash,
    };

    console.log('JSON Output:');
    console.log(JSON.stringify(resultData, null, 2));
    console.log('\n');

    return resultData;
  } catch (error) {
    console.error('\n❌ Error creating account:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error) {
      if (error.message.includes('op_underfunded')) {
        console.error('   Reason: Sponsor account has insufficient funds');
      } else if (error.message.includes('op_already_exists')) {
        console.error('   Reason: Account already exists on Stellar network');
      } else if (error.message.includes('tx_bad_seq')) {
        console.error('   Reason: Stellar network sequence error - please retry');
      } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        console.error('   Reason: Request timeout - Stellar network did not respond');
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        console.error('   Reason: Network error - unable to connect to Stellar network');
      }
    }
    
    process.exit(1);
  }
}

// Run the script
createAndEncryptAccount();

