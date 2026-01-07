import {
  Asset,
  Keypair,
  Horizon,
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
  StrKey,
} from '@stellar/stellar-sdk';
import StellarHDWallet from 'stellar-hd-wallet';
import encryptionService from '../encryption/encryption.service';

import { HttpException } from '../exceptions/http.exception';

import logger from '../utils/logger.utils';

/**
 * Stellar Service
 * Handles all Stellar blockchain operations
 *
 * ⚠️ INTERNAL SERVICE:
 * - This service is for INTERNAL backend use only
 * - Use in services layer, not controllers or routes
 * - Private keys should be encrypted before storage
 * - Never expose private keys via API
 *
 * @internal - For internal codebase use only
 */
class StellarService {
  // private server: StellarSDK.Horizon.Server;
  // private networkPassphrase: string;
  private params = {
    fee: BASE_FEE,
    networkPassphrase: process.env.NODE_ENV === 'production' ? Networks.PUBLIC : Networks.TESTNET,
  };
  private readonly encryptionService = encryptionService;

  /**
   * Generate a mnemonic phrase, derive a keypair from it, create the account on Stellar network,
   * and automatically add a trustline for the new wallet.
   * @returns Object with mnemonic, publicKey, encrypted secret, transaction info, and trustline status
   * @throws Error if wallet generation, account creation, or trustline setup fails
   */
  async generateAndCreateAccount(
    UserId: number,
    UserEmail: string,
    Username: string,
    DeveloperId: number,
    BlockchainType: 'STELLAR',
    BlockchainAction: 'CREATE'
  ): Promise<{
    UserId: number;
    WalletAddress: string;
    WalletSecret: string;
    WalletMnemonic: string;
    ActivationStatus: boolean;
    DeveloperId: number;
    BlockchainType: 'STELLAR';
    BlockchainAction: 'CREATE';
  }> {
    const logContext = '[StellarService.generateAndCreateAccount]';

    // Step 1: Generate mnemonic phrase
    let mnemonic: string;
    let keypair: Keypair;
    let secretKey: string;
    let publicKey: string;

    try {
      logger.debug(`${logContext} Generating mnemonic phrase`);

      // Generate a mnemonic (12 or 24 words)
      mnemonic = StellarHDWallet.generateMnemonic();

      // Derive a keypair from the mnemonic (using default path m/44'/148'/0')
      const wallet = StellarHDWallet.fromMnemonic(mnemonic);
      keypair = wallet.getKeypair(0);

      // Get public and secret keys
      publicKey = keypair.publicKey();
      secretKey = keypair.secret();

      logger.debug(`${logContext} Generated mnemonic and keypair for public key ${publicKey}, account index 0`);
    } catch (error) {
      logger.error(`${logContext} Failed to generate mnemonic: ${error instanceof Error ? error.message : error}`);

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to generate mnemonic',
          errorCode: 'MNEMONIC_GENERATION_FAILED',
          retryable: true,
          retryAfter: 2,
          details: 'Failed to generate mnemonic phrase. Please retry the request.',
        },
        500
      );
    }
    let transactionHash = '';
    let trustlineAdded = false;

    try {
      logger.debug(`${logContext} Starting account creation workflow`);

      // Step 3: Validate environment variables
      if (!process.env.STELLAR_HORIZON_URL) {
        logger.error(`${logContext} Missing STELLAR_HORIZON_URL`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'STELLAR_HORIZON_URL not configured',
            errorCode: 'CONFIG_MISSING_HORIZON_URL',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      const sponsorPubKey = process.env.SPONSOR_PUBLIC_KEY;
      if (!sponsorPubKey) {
        logger.error(`${logContext} Missing SPONSOR_PUBLIC_KEY`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'SPONSOR_PUBLIC_KEY not configured',
            errorCode: 'CONFIG_MISSING_SPONSOR_KEY',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      if (!process.env.SPONSOR_PRIVATE_KEY) {
        logger.error(`${logContext} Missing SPONSOR_PRIVATE_KEY`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'SPONSOR_PRIVATE_KEY not configured',
            errorCode: 'CONFIG_MISSING_SPONSOR_SECRET',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      // Step 4: Create account on Stellar network
      const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
      const sourceAccount = await server.loadAccount(sponsorPubKey);
      const sponsorKeypair = Keypair.fromSecret(process.env.SPONSOR_PRIVATE_KEY);

      // Build sponsored transaction
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: this.params.fee,
        networkPassphrase: this.params.networkPassphrase,
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
      logger.debug(`${logContext} Built sponsorship transaction for ${publicKey}`);

      // Sign with both sponsor and new account
      transaction.sign(sponsorKeypair);
      transaction.sign(keypair);
      logger.debug(`${logContext} Transaction signed by sponsor and new account`);

      // Submit transaction
      const result = await server.submitTransaction(transaction);
      transactionHash = result.hash;
      logger.info(`Account created successfully: ${publicKey}, tx: ${transactionHash}`);
    } catch (error) {
      logger.error(
        `${logContext} Failed to generate and create account: ${error instanceof Error ? error.message : error}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('op_underfunded')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Sponsor account has insufficient funds',
              errorCode: 'STELLAR_INSUFFICIENT_FUNDS',
              retryable: false,
              details:
                'The sponsor account does not have enough funds to create the account. This is a permanent error.',
            },
            400
          );
        } else if (error.message.includes('tx_bad_seq')) {
          throw new HttpException(
            {
              status: 503,
              success: false,
              message: 'Service temporarily unavailable, please try again',
              errorCode: 'STELLAR_SEQUENCE_ERROR',
              retryable: true,
              retryAfter: 5,
              details: 'The Stellar network is experiencing high load. Please retry after a few seconds.',
            },
            503
          );
        } else if (error.message.includes('op_already_exists')) {
          throw new HttpException(
            {
              status: 409,
              success: false,
              message: 'Account already exists',
              errorCode: 'STELLAR_ACCOUNT_EXISTS',
              retryable: false,
              details: 'An account with this public key already exists on the Stellar network.',
            },
            409
          );
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          throw new HttpException(
            {
              status: 504,
              success: false,
              message: 'Request timeout - Stellar network did not respond in time',
              errorCode: 'STELLAR_TIMEOUT',
              retryable: true,
              retryAfter: 10,
              details: 'The request to the Stellar network timed out. Please retry the request.',
            },
            504
          );
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          throw new HttpException(
            {
              status: 503,
              success: false,
              message: 'Network error - unable to connect to Stellar network',
              errorCode: 'STELLAR_NETWORK_ERROR',
              retryable: true,
              retryAfter: 15,
              details: 'Unable to connect to the Stellar network. Please retry after a few seconds.',
            },
            503
          );
        }
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to generate and create account',
          errorCode: 'STELLAR_ACCOUNT_CREATION_FAILED',
          retryable: true,
          retryAfter: 5,
          details: 'An unexpected error occurred while creating the account. Please retry the request.',
        },
        500
      );
    }
    try {
      logger.debug(`${logContext} Initiating trustline setup for ${publicKey}`);
      await this.addTrustline(publicKey, secretKey);
      trustlineAdded = true;
    } catch (error) {
      logger.error(
        `${logContext} Failed to add trustline for ${publicKey}: ${error instanceof Error ? error.message : error}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to add trustline after account creation',
          errorCode: 'TRUSTLINE_SETUP_FAILED',
          retryable: true,
          retryAfter: 5,
          details:
            'Account was created but trustline setup failed. You may need to add the trustline manually or retry.',
        },
        500
      );
    }

    const encryptedSecret = await this.encryptionService.encryptSecretKey(secretKey);
    logger.debug(`${logContext} Secret key encrypted for ${publicKey}`);

    return {
      UserId: UserId,
      WalletAddress: publicKey,
      WalletSecret: encryptedSecret,
      WalletMnemonic: mnemonic,
      ActivationStatus: trustlineAdded,
      DeveloperId: DeveloperId,
      BlockchainType: BlockchainType,
      BlockchainAction: BlockchainAction,
    };
  }

  async sendSyteTokens(
    UserId: number,
    DeveloperId: number,
    WalletAddress: string,
    AmountPaid: number
  ): Promise<{
    UserId: number;
    DeveloperId: number;
    WalletAddress: string;
    TransactionStatus: boolean;
    TransactionReference: string;
    TokenIssued: number;
    TokenType: 'SYTE';
  }> {
    const logContext = '[StellarService.sendSyteTokens]';

    if (!process.env.STELLAR_HORIZON_URL) {
      logger.error(`${logContext} Missing STELLAR_HORIZON_URL`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'STELLAR_HORIZON_URL not configured',
          errorCode: 'CONFIG_MISSING_HORIZON_URL',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTE_DISTRIBUTOR_ADDRESS) {
      logger.error(`${logContext} Missing SYTE_DISTRIBUTOR_ADDRESS`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTE_DISTRIBUTOR_ADDRESS not configured',
          errorCode: 'CONFIG_MISSING_DISTRIBUTOR_ADDRESS',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTE_DISTRIBUTOR_PRIVATE_KEY) {
      logger.error(`${logContext} Missing SYTE_DISTRIBUTOR_PRIVATE_KEY`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTE_DISTRIBUTOR_PRIVATE_KEY not configured',
          errorCode: 'CONFIG_MISSING_DISTRIBUTOR_SECRET',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SPONSOR_PRIVATE_KEY) {
      logger.error(`${logContext} Missing SPONSOR_PRIVATE_KEY`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SPONSOR_PRIVATE_KEY not configured',
          errorCode: 'CONFIG_MISSING_SPONSOR_SECRET',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTE_ASSET_CODE) {
      logger.error(`${logContext} Missing SYTE_ASSET_CODE`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTE_ASSET_CODE not configured',
          errorCode: 'CONFIG_MISSING_ASSET_CODE',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTE_ISSUER_ADDRESS) {
      logger.error(`${logContext} Missing SYTE_ISSUER_ADDRESS`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTE_ISSUER_ADDRESS not configured',
          errorCode: 'CONFIG_MISSING_ISSUER_ADDRESS',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    // Validate wallet address
    if (!WalletAddress || typeof WalletAddress !== 'string') {
      logger.error(`${logContext} Invalid WalletAddress: ${WalletAddress}`);
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address',
          errorCode: 'INVALID_WALLET_ADDRESS',
          retryable: false,
          details: 'The provided wallet address is invalid or missing. Please provide a valid Stellar public key.',
        },
        400
      );
    }

    // Validate Stellar public key format
    if (!StrKey.isValidEd25519PublicKey(WalletAddress)) {
      logger.error(`${logContext} Invalid Stellar public key format: ${WalletAddress}`);
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address format',
          errorCode: 'INVALID_WALLET_ADDRESS_FORMAT',
          retryable: false,
          details: 'The wallet address must be a valid Stellar public key (starts with G and is 56 characters long).',
        },
        400
      );
    }

    // Validate AmountPaid
    if (!AmountPaid || typeof AmountPaid !== 'number' || AmountPaid <= 0) {
      logger.error(`${logContext} Invalid AmountPaid: ${AmountPaid}`);
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid amount',
          errorCode: 'INVALID_AMOUNT',
          retryable: false,
          details: 'The amount must be a positive number greater than zero.',
        },
        400
      );
    }

    const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
    const vaultAddress = await server.loadAccount(process.env.SYTE_DISTRIBUTOR_ADDRESS);
    const vaultKeypair = Keypair.fromSecret(process.env.SYTE_DISTRIBUTOR_PRIVATE_KEY);
    const feeKeypair = Keypair.fromSecret(process.env.SPONSOR_PRIVATE_KEY);

    // Create asset object
    const paymentAsset = new Asset(process.env.SYTE_ASSET_CODE, process.env.SYTE_ISSUER_ADDRESS);

    // Start transaction
    const transaction = new TransactionBuilder(vaultAddress, {
      fee: BASE_FEE,
      networkPassphrase: this.params.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: WalletAddress,
          asset: paymentAsset,
          amount: AmountPaid.toString(),
        })
      )
      .setTimeout(180)
      .build();
    transaction.sign(vaultKeypair);

    // Build the fee-bump transaction
    const feeBumpTransaction = TransactionBuilder.buildFeeBumpTransaction(
      feeKeypair,
      (Number(BASE_FEE) * 2).toString(),
      transaction,
      this.params.networkPassphrase
    );

    // Sign the fee-bump transaction with the fee account
    feeBumpTransaction.sign(feeKeypair);

    try {
      const result = await server.submitTransaction(feeBumpTransaction);
      logger.info(`${logContext} SYTE tokens sent successfully. Hash: ${result.hash}`);

      return {
        UserId: UserId,
        DeveloperId: DeveloperId,
        WalletAddress: WalletAddress,
        TransactionStatus: true,
        TransactionReference: result.hash,
        TokenIssued: AmountPaid,
        TokenType: 'SYTE',
      };
    } catch (error) {
      logger.error(`${logContext} Failed to send SYTE tokens: ${error instanceof Error ? error.message : error}`);

      if (error instanceof HttpException) {
        throw error;
      }

      // Handle invalid destination error
      if (error instanceof Error && error.message.includes('destination is invalid')) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Invalid wallet address',
            errorCode: 'INVALID_DESTINATION_ADDRESS',
            retryable: false,
            details:
              'The provided wallet address is not a valid Stellar public key. Please check the address and try again.',
          },
          400
        );
      }

      const errorDetails = (
        error as { response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } } }
      )?.response?.data?.extras;
      const operations = errorDetails?.result_codes?.operations;

      // Check error message as fallback (in case operations array format is different)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);

      // Handle case where destination account doesn't have trustline for SYTE token
      // Check both operations array and error message/string
      if (
        (operations && operations.includes('op_no_destination')) ||
        errorMessage.includes('op_no_destination') ||
        errorString.includes('op_no_destination')
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Account not activivated',
            errorCode: 'NO_TRUSTLINE',
            retryable: false,
            details:
              'The destination wallet does not have a trustline for SYTE tokens. The wallet must first establish a trustline for SYTE tokens before receiving them.',
          },
          400
        );
      }

      // Custom error handling for insufficient balance
      if (
        (operations && operations.includes('op_underfunded')) ||
        errorMessage.includes('op_underfunded') ||
        errorString.includes('op_underfunded')
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Service not available',
            errorCode: 'INSUFFICIENT_FUNDS',
            retryable: false,
            details: 'The distributor account has insufficient funds to send tokens.',
          },
          400
        );
      }

      // Handle case where destination account doesn't exist
      if (operations && operations.includes('op_no_account')) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Account does not exist',
            errorCode: 'ACCOUNT_NOT_FOUND',
            retryable: false,
            details:
              'The destination wallet address does not exist on the Stellar network. Please verify the wallet address.',
          },
          400
        );
      }

      // Handle other Stellar operation errors
      if (operations && operations.length > 0) {
        const errorMessage = operations.join(', ');
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Transaction failed',
            errorCode: 'STELLAR_OPERATION_ERROR',
            retryable: true,
            retryAfter: 5,
            details: `Stellar operation error: ${errorMessage}`,
          },
          400
        );
      }

      // Throw generic error if no specific handling
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to send SYTE tokens',
          errorCode: 'TOKEN_SEND_FAILED',
          retryable: true,
          retryAfter: 5,
          details:
            error instanceof Error
              ? error.message
              : 'An error occurred while sending SYTE tokens. Please retry the request.',
        },
        500
      );
    }
  }

  /**
   * Add trustline for SYTE currency using provided keys.
   * @param publicKey - Account public key
   * @param decryptedSecret - Plain secret key (will not be stored)
   */
  private async addTrustline(publicKey: string, decryptedSecret: string): Promise<void> {
    const logContext = '[StellarService.addTrustline]';
    if (!publicKey || !decryptedSecret) {
      logger.error(
        `${logContext} Missing credentials | publicKeyPresent=${Boolean(publicKey)} secretPresent=${Boolean(decryptedSecret)}`
      );
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Public key and secret key are required',
          errorCode: 'TRUSTLINE_MISSING_CREDENTIALS',
          retryable: false,
          details: 'Both public key and secret key must be provided to add a trustline.',
        },
        400
      );
    }

    try {
      logger.debug(`${logContext} Starting trustline workflow for ${publicKey}`);
      if (!process.env.SPONSOR_PRIVATE_KEY) {
        logger.error(`${logContext} Missing SPONSOR_PRIVATE_KEY`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'SPONSOR_PRIVATE_KEY not configured',
            errorCode: 'CONFIG_MISSING_SPONSOR_SECRET',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      if (!process.env.STELLAR_HORIZON_URL) {
        logger.error(`${logContext} Missing STELLAR_HORIZON_URL`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'STELLAR_HORIZON_URL not configured',
            errorCode: 'CONFIG_MISSING_HORIZON_URL',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      if (!process.env.SYTE_ASSET_CODE) {
        logger.error(`${logContext} Missing SYTE_ASSET_CODE`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'SYTE_ASSET_CODE not configured',
            errorCode: 'CONFIG_MISSING_ASSET_CODE',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      if (!process.env.SYTE_ISSUER_ADDRESS) {
        logger.error(`${logContext} Missing SYTE_ISSUER_ADDRESS`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'SYTE_ASSET_ISSUER not configured',
            errorCode: 'CONFIG_MISSING_ISSUER_ADDRESS',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      const sponsorPubKey = process.env.SPONSOR_PUBLIC_KEY;
      if (!sponsorPubKey) {
        logger.error(`${logContext} Missing SPONSOR_PUBLIC_KEY`);
        throw new HttpException(
          {
            status: 500,
            success: false,
            message: 'SPONSOR_PUBLIC_KEY not configured',
            errorCode: 'CONFIG_MISSING_SPONSOR_KEY',
            retryable: false,
            details: 'Server configuration error. Please contact support.',
          },
          500
        );
      }

      const sponsorKeypair = Keypair.fromSecret(process.env.SPONSOR_PRIVATE_KEY);
      const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
      const paymentAsset = new Asset(process.env.SYTE_ASSET_CODE, process.env.SYTE_ISSUER_ADDRESS);
      const sourceAccount = await server.loadAccount(sponsorPubKey);
      logger.debug(`${logContext} Loaded sponsor account ${sponsorPubKey}`);

      // Validate and create user keypair
      let userKeypair: Keypair;
      try {
        userKeypair = Keypair.fromSecret(decryptedSecret);
        const derivedPublicKey = userKeypair.publicKey();
        if (derivedPublicKey !== publicKey) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Secret key does not match wallet address',
              errorCode: 'SECRET_KEY_MISMATCH',
              retryable: false,
              details: `The secret key does not match the wallet address. Expected: ${publicKey}, Got: ${derivedPublicKey}`,
            },
            400
          );
        }
        logger.debug(`${logContext} Prepared trustline transaction context for ${publicKey}`);
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        if (error instanceof Error && error.message.includes('Invalid secret key')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Invalid secret key format',
              errorCode: 'INVALID_SECRET_KEY_FORMAT',
              retryable: false,
              details: 'The provided secret key is not a valid Stellar secret key format.',
            },
            400
          );
        }

        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Failed to create keypair from secret key',
            errorCode: 'KEYPAIR_CREATION_FAILED',
            retryable: false,
            details: 'The secret key could not be used to create a keypair. Please verify the secret key is correct.',
          },
          400
        );
      }

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.params.networkPassphrase,
      })
        .addOperation(
          Operation.beginSponsoringFutureReserves({
            sponsoredId: publicKey,
          })
        )
        .addOperation(
          Operation.changeTrust({
            source: publicKey,
            asset: paymentAsset,
            limit: '10000000',
          })
        )
        .addOperation(
          Operation.endSponsoringFutureReserves({
            source: publicKey,
          })
        )
        .setTimeout(180)
        .build();

      transaction.sign(sponsorKeypair);
      transaction.sign(userKeypair);
      logger.debug(`${logContext} Signed trustline transaction for ${publicKey}`);

      // Check if trustline already exists before attempting to add it
      try {
        const account = await server.loadAccount(publicKey);
        const trustlineExists = account.balances.some(
          (balance: any) =>
            balance.asset_type !== 'native' &&
            balance.asset_code === process.env.SYTE_ASSET_CODE &&
            balance.asset_issuer === process.env.SYTE_ISSUER_ADDRESS
        );

        if (trustlineExists) {
          logger.info(`${logContext} Trustline already exists for ${publicKey}`);
          return; // Trustline already exists, no need to add it
        }
      } catch (accountError) {
        // If account doesn't exist, we'll let the transaction fail with a more specific error
        logger.debug(
          `${logContext} Could not check account status: ${accountError instanceof Error ? accountError.message : accountError}`
        );
      }

      await server.submitTransaction(transaction);
      logger.info(`Trustline added successfully for account: ${publicKey}`);
    } catch (error) {
      // Log detailed error information for debugging - capture everything
      const errorLog: any = {
        errorType: error?.constructor?.name || typeof error,
      };

      if (error instanceof Error) {
        errorLog.message = error.message;
        errorLog.stack = error.stack;
        errorLog.name = error.name;
      }

      // Capture Stellar SDK error response structure
      const errorAny = error as any;
      if (errorAny.response) {
        errorLog.response = {
          status: errorAny.response.status,
          statusText: errorAny.response.statusText,
          data: errorAny.response.data,
        };
      }

      // Also capture any other properties
      if (errorAny.extras) {
        errorLog.extras = errorAny.extras;
      }
      if (errorAny.result_codes) {
        errorLog.result_codes = errorAny.result_codes;
      }

      logger.error(`${logContext} Failed to add trustline for ${publicKey}: ${JSON.stringify(errorLog, null, 2)}`);

      if (error instanceof HttpException) {
        throw error;
      }

      // Check for Stellar transaction response errors - handle multiple possible error structures
      const stellarError = error as {
        response?: {
          status?: number;
          data?: {
            extras?: {
              result_codes?: {
                transaction?: string;
                operations?: string[];
              };
            };
            type?: string;
            title?: string;
            detail?: string;
          };
        };
        message?: string;
        name?: string;
        extras?: {
          result_codes?: {
            transaction?: string;
            operations?: string[];
          };
        };
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };

      // Try to extract error codes from different possible locations
      // Stellar SDK errors can have the structure in multiple places:
      // 1. error.response.data.extras.result_codes (most common)
      // 2. error.extras.result_codes (alternative)
      // 3. error.result_codes (direct)
      const errorDetails = stellarError?.response?.data?.extras || stellarError?.extras;
      const transactionCode = errorDetails?.result_codes?.transaction || stellarError?.result_codes?.transaction;
      const operations = errorDetails?.result_codes?.operations || stellarError?.result_codes?.operations || [];
      const errorMessage = stellarError?.message || '';
      const errorString = JSON.stringify(error);

      // Also check the error message and stringified error for operation codes
      const allErrorText = `${errorMessage} ${errorString}`.toLowerCase();

      // Handle transaction-level errors
      if (transactionCode) {
        if (transactionCode === 'tx_bad_auth') {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Transaction authorization failed',
              errorCode: 'STELLAR_AUTH_FAILED',
              retryable: false,
              details:
                'The transaction could not be authorized. This usually means the secret key does not match the wallet address or the account does not exist.',
            },
            400
          );
        } else if (transactionCode === 'tx_bad_seq') {
          throw new HttpException(
            {
              status: 503,
              success: false,
              message: 'Service temporarily unavailable, please try again',
              errorCode: 'STELLAR_SEQUENCE_ERROR',
              retryable: true,
              retryAfter: 5,
              details: 'The Stellar network is experiencing high load. Please retry after a few seconds.',
            },
            503
          );
        }
      }

      // Handle operation-level errors
      if (operations && operations.length > 0) {
        if (operations.includes('op_no_account')) {
          throw new HttpException(
            {
              status: 404,
              success: false,
              message: 'Account does not exist',
              errorCode: 'ACCOUNT_NOT_FOUND',
              retryable: false,
              details: 'The wallet address does not exist on the Stellar network. Please verify the wallet address.',
            },
            404
          );
        } else if (operations.includes('op_bad_auth')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Secret key does not match wallet address',
              errorCode: 'SECRET_KEY_MISMATCH',
              retryable: false,
              details:
                'The provided secret key does not belong to the specified wallet address. Please ensure the secret key matches the wallet address.',
            },
            400
          );
        } else if (operations.includes('op_line_full')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Trustline limit reached',
              errorCode: 'TRUSTLINE_LIMIT_REACHED',
              retryable: false,
              details: 'The trustline limit has been reached. Cannot add more trustlines to this account.',
            },
            400
          );
        } else if (operations.includes('op_low_reserve')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Insufficient reserves',
              errorCode: 'INSUFFICIENT_RESERVES',
              retryable: false,
              details: 'The account does not have sufficient reserves to add the trustline.',
            },
            400
          );
        }
      }

      // Check error message and stringified error for operation codes (fallback)
      if (error instanceof Error) {
        if (allErrorText.includes('op_underfunded') || allErrorText.includes('underfunded')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Sponsor account has insufficient funds',
              errorCode: 'STELLAR_INSUFFICIENT_FUNDS',
              retryable: false,
              details:
                'The sponsor account does not have enough funds to add the trustline. This is a permanent error.',
            },
            400
          );
        } else if (allErrorText.includes('tx_bad_seq') || allErrorText.includes('bad_seq')) {
          throw new HttpException(
            {
              status: 503,
              success: false,
              message: 'Service temporarily unavailable, please try again',
              errorCode: 'STELLAR_SEQUENCE_ERROR',
              retryable: true,
              retryAfter: 5,
              details: 'The Stellar network is experiencing high load. Please retry after a few seconds.',
            },
            503
          );
        } else if (allErrorText.includes('op_no_trust') || allErrorText.includes('no_trust')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Trustline operation failed',
              errorCode: 'STELLAR_TRUSTLINE_FAILED',
              retryable: false,
              details:
                'The trustline operation failed. This may indicate an issue with the account or asset configuration.',
            },
            400
          );
        } else if (allErrorText.includes('op_line_full') || allErrorText.includes('line_full')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Trustline limit reached',
              errorCode: 'TRUSTLINE_LIMIT_REACHED',
              retryable: false,
              details: 'The trustline limit has been reached. Cannot add more trustlines to this account.',
            },
            400
          );
        } else if (allErrorText.includes('op_low_reserve') || allErrorText.includes('low_reserve')) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Insufficient reserves',
              errorCode: 'INSUFFICIENT_RESERVES',
              retryable: false,
              details: 'The account does not have sufficient reserves to add the trustline.',
            },
            400
          );
        } else if (allErrorText.includes('timeout') || allErrorText.includes('TIMEOUT')) {
          throw new HttpException(
            {
              status: 504,
              success: false,
              message: 'Request timeout - Stellar network did not respond in time',
              errorCode: 'STELLAR_TIMEOUT',
              retryable: true,
              retryAfter: 10,
              details: 'The request to the Stellar network timed out. Please retry the request.',
            },
            504
          );
        } else if (
          allErrorText.includes('network') ||
          allErrorText.includes('connection') ||
          allErrorText.includes('econnrefused')
        ) {
          throw new HttpException(
            {
              status: 503,
              success: false,
              message: 'Network error - unable to connect to Stellar network',
              errorCode: 'STELLAR_NETWORK_ERROR',
              retryable: true,
              retryAfter: 15,
              details: 'Unable to connect to the Stellar network. Please retry after a few seconds.',
            },
            503
          );
        } else if (allErrorText.includes('op_already_exists') || allErrorText.includes('already_exists')) {
          // Trustline might already exist - this is actually a success case
          logger.info(`${logContext} Trustline already exists for ${publicKey}`);
          return; // Trustline already exists, treat as success
        }
      }

      // If we have a response with status code, use it for better error messages
      if (stellarError?.response?.status) {
        const status = stellarError.response.status;
        if (status === 400) {
          throw new HttpException(
            {
              status: 400,
              success: false,
              message: 'Invalid transaction request',
              errorCode: 'STELLAR_BAD_REQUEST',
              retryable: false,
              details:
                stellarError.response.data?.detail ||
                'The transaction request was invalid. Please check the wallet address and secret key.',
            },
            400
          );
        } else if (status === 404) {
          throw new HttpException(
            {
              status: 404,
              success: false,
              message: 'Account not found',
              errorCode: 'ACCOUNT_NOT_FOUND',
              retryable: false,
              details: 'The wallet address does not exist on the Stellar network.',
            },
            404
          );
        } else if (status >= 500) {
          throw new HttpException(
            {
              status: 503,
              success: false,
              message: 'Stellar network error',
              errorCode: 'STELLAR_SERVER_ERROR',
              retryable: true,
              retryAfter: 10,
              details: 'The Stellar network is experiencing issues. Please retry after a few seconds.',
            },
            503
          );
        }
      }

      // Last resort - provide detailed error information
      const detailedError = {
        message: errorMessage,
        transactionCode,
        operations,
        responseStatus: stellarError?.response?.status,
        responseData: stellarError?.response?.data,
      };

      logger.error(`${logContext} Unhandled error details: ${JSON.stringify(detailedError, null, 2)}`);

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to add trustline',
          errorCode: 'TRUSTLINE_ADDITION_FAILED',
          retryable: true,
          retryAfter: 5,
          details: `An unexpected error occurred while adding the trustline. ${transactionCode ? `Transaction code: ${transactionCode}. ` : ''}${operations.length > 0 ? `Operation codes: ${operations.join(', ')}. ` : ''}Please check the logs for more details.`,
        },
        500
      );
    }
  }

  /**
   * Admin function to activate SYTE token trustline for a wallet
   *
   * IMPORTANT: Only use this function if you are certain that:
   * - The account already exists on the Stellar network (on-chain)
   * - The account only lacks the SYTE token trustline activation
   *
   * This function will fail if the account does not exist on-chain.
   *
   * @param walletAddress - Stellar wallet address (must exist on-chain)
   * @param encryptedSecretKey - Encrypted secret key for the wallet
   * @returns Activation status
   */
  async activateSyteTokenTrustline(
    walletAddress: string,
    encryptedSecretKey: string
  ): Promise<{
    WalletAddress: string;
    ActivationStatus: boolean;
    message: string;
  }> {
    const logContext = '[StellarService.activateSyteTokenTrustline]';

    // Validate wallet address
    if (!walletAddress) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Wallet address is required',
          errorCode: 'MISSING_WALLET_ADDRESS',
          retryable: false,
          details: 'Wallet address must be provided.',
        },
        400
      );
    }

    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address format',
          errorCode: 'INVALID_WALLET_ADDRESS_FORMAT',
          retryable: false,
          details: 'The wallet address must be a valid Stellar public key.',
        },
        400
      );
    }

    if (!encryptedSecretKey) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Encrypted secret key is required',
          errorCode: 'MISSING_ENCRYPTED_SECRET_KEY',
          retryable: false,
          details: 'Encrypted secret key must be provided.',
        },
        400
      );
    }

    // Decrypt the secret key
    let secretKey: string;
    try {
      secretKey = await this.encryptionService.decryptSecretKey(encryptedSecretKey);
      logger.debug(`${logContext} Secret key decrypted for wallet ${walletAddress}`);
    } catch (error) {
      logger.error(`${logContext} Failed to decrypt secret key: ${error instanceof Error ? error.message : error}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to decrypt secret key',
          errorCode: 'SECRET_KEY_DECRYPTION_FAILED',
          retryable: false,
          details:
            'An error occurred while decrypting the secret key. Make sure the encrypted secret key is the one provided during account creation',
        },
        500
      );
    }

    // Validate that the secret key matches the wallet address
    try {
      const keypair = Keypair.fromSecret(secretKey);
      const derivedPublicKey = keypair.publicKey();

      if (derivedPublicKey !== walletAddress) {
        logger.error(`${logContext} Secret key mismatch. Wallet: ${walletAddress}, Derived: ${derivedPublicKey}`);
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Secret key does not match wallet address',
            errorCode: 'SECRET_KEY_MISMATCH',
            retryable: false,
            details:
              'The provided encrypted secret key does not belong to the specified wallet address. Please ensure the secret key matches the wallet address.',
          },
          400
        );
      }
      logger.debug(`${logContext} Secret key validated - matches wallet address`);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle invalid secret key format
      if (
        error instanceof Error &&
        (error.message.includes('Invalid secret key') || error.message.includes('invalid'))
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Invalid secret key format',
            errorCode: 'INVALID_SECRET_KEY_FORMAT',
            retryable: false,
            details: 'The decrypted secret key is not a valid Stellar secret key format.',
          },
          400
        );
      }

      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Secret key validation failed',
          errorCode: 'SECRET_KEY_VALIDATION_FAILED',
          retryable: false,
          details: 'Failed to validate the secret key. Please check that the encrypted secret key is correct.',
        },
        400
      );
    }

    // Check if trustline already exists before attempting to add it
    try {
      if (!process.env.SYTE_ASSET_CODE || !process.env.SYTE_ISSUER_ADDRESS || !process.env.STELLAR_HORIZON_URL) {
        logger.warn(
          `${logContext} SYTE_ASSET_CODE, SYTE_ISSUER_ADDRESS, or STELLAR_HORIZON_URL not configured, skipping trustline check`
        );
      } else {
        const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
        const account = await server.loadAccount(walletAddress);
        const trustlineExists = account.balances.some(
          (balance: any) =>
            balance.asset_type !== 'native' &&
            balance.asset_code === process.env.SYTE_ASSET_CODE &&
            balance.asset_issuer === process.env.SYTE_ISSUER_ADDRESS
        );

        if (trustlineExists) {
          logger.info(`${logContext} Trustline already exists for ${walletAddress}`);
          return {
            WalletAddress: walletAddress,
            ActivationStatus: true,
            message: 'SYTE token trustline is already activated for this wallet',
          };
        }
      }
    } catch (accountError) {
      // If account doesn't exist, we'll let addTrustline handle the error
      if (accountError instanceof Error && accountError.message.includes('404')) {
        logger.error(`${logContext} Account does not exist on Stellar network: ${walletAddress}`);
        throw new HttpException(
          {
            status: 404,
            success: false,
            message: 'Account does not exist on Stellar network',
            errorCode: 'ACCOUNT_NOT_FOUND',
            retryable: false,
            details:
              'The wallet address does not exist on the Stellar network. Please ensure the account has been created on-chain before activating the trustline.',
          },
          404
        );
      }
      logger.debug(
        `${logContext} Could not check account status: ${accountError instanceof Error ? accountError.message : accountError}`
      );
    }

    // Use the existing addTrustline method (same as in generateAndCreateAccount)
    try {
      logger.debug(`${logContext} Initiating trustline setup for ${walletAddress}`);
      await this.addTrustline(walletAddress, secretKey);
      logger.info(`${logContext} SYTE token trustline activated successfully for wallet ${walletAddress}`);

      return {
        WalletAddress: walletAddress,
        ActivationStatus: true,
        message: 'SYTE token trustline activated successfully',
      };
    } catch (error) {
      logger.error(
        `${logContext} Failed to add trustline for ${walletAddress}: ${error instanceof Error ? error.message : error}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to activate SYTE token trustline',
          errorCode: 'TRUSTLINE_ACTIVATION_FAILED',
          retryable: true,
          retryAfter: 5,
          details: 'An error occurred while activating the trustline. Please retry the request.',
        },
        500
      );
    }
  }

  /**
   * Get wallet assets
   * @param walletAddress - Stellar wallet address
   * @returns Wallet details with balances
   */
  async GetStellarWallet(walletAddress: string): Promise<{
    status: number;
    success: boolean;
    message: string;
    data: {
      wallet: {
        address: string;
        network: string;
        balances: any[];
      };
    };
  }> {
    const logContext = '[StellarService.GetStellarWallet]';

    if (!walletAddress) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Wallet address is required',
          errorCode: 'MISSING_WALLET_ADDRESS',
          retryable: false,
          details: 'Wallet address must be provided.',
        },
        400
      );
    }

    // Validate wallet address format
    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address format',
          errorCode: 'INVALID_WALLET_ADDRESS_FORMAT',
          retryable: false,
          details: 'The wallet address must be a valid Stellar public key.',
        },
        400
      );
    }

    if (!process.env.STELLAR_HORIZON_URL) {
      logger.error(`${logContext} Missing STELLAR_HORIZON_URL`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'STELLAR_HORIZON_URL not configured',
          errorCode: 'CONFIG_MISSING_HORIZON_URL',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    // Get initial balances
    const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
    const currentBalances = await this.getStellarAssetBalances(walletAddress, server);

    return {
      status: 200,
      success: true,
      message: 'Wallet details retrieved successfully',
      data: {
        wallet: {
          address: walletAddress,
          network: this.params.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet',
          balances: currentBalances,
        },
      },
    };
  }

  /**
   * Get all transaction history
   * @param walletAddress - Stellar wallet address
   * @returns Transaction history
   */
  async getStellarAllTransactionHistory(walletAddress: string): Promise<{
    status: number;
    success: boolean;
    message: string;
    data: {
      walletAddress: string;
      totalTransactions: number;
      transactions: any[];
    };
  }> {
    const logContext = '[StellarService.getStellarAllTransactionHistory]';

    if (!walletAddress) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Wallet address is required',
          errorCode: 'MISSING_WALLET_ADDRESS',
          retryable: false,
          details: 'Wallet address must be provided.',
        },
        400
      );
    }

    // Validate wallet address format
    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address format',
          errorCode: 'INVALID_WALLET_ADDRESS_FORMAT',
          retryable: false,
          details: 'The wallet address must be a valid Stellar public key.',
        },
        400
      );
    }

    if (!process.env.STELLAR_HORIZON_URL) {
      logger.error(`${logContext} Missing STELLAR_HORIZON_URL`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'STELLAR_HORIZON_URL not configured',
          errorCode: 'CONFIG_MISSING_HORIZON_URL',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);

    const transactions = await server
      .transactions()
      .forAccount(walletAddress)
      .limit(10) // Adjust limit as needed
      .order('desc') // Most recent first
      .call();

    // Extract ALL operation details (not just payments)
    const allTransactionDetails = await Promise.all(
      transactions.records.map(async (transaction) => {
        const operations = await transaction.operations();
        return operations.records
          .filter((op) => {
            // Filter out sponsorship and internal operations
            const excludedOperations = [
              'begin_sponsoring_future_reserves',
              'end_sponsoring_future_reserves',
              'create_claimable_balance',
              'claim_claimable_balance',
              'clawback',
              'clawback_claimable_balance',
              'set_trust_line_flags',
              'liquidity_pool_deposit',
              'liquidity_pool_withdraw',
              'inflation',
              'manage_data',
              'bump_sequence',
              'extend_footprint_ttl',
              'restore_footprint',
              'change_trust',
              'create_account',
            ];
            return !excludedOperations.includes(op.type);
          })
          .map((op) => ({
            operationType: op.type,
            amount: (op as any).amount || (op as any).limit || (op as any).starting_balance || null,
            asset: (op as any).asset_type === 'native' ? 'XLM' : (op as any).asset_code || null,
            from: (op as any).from || null,
            to: (op as any).to || null,
            timestamp: transaction.created_at,
            status: 'success',
            description: this.getOperationDescription(op.type, walletAddress, op),
          }));
      })
    ).then((results) => results.flat()); // Flatten the nested arrays

    return {
      status: 200,
      success: true,
      message: 'All transactions fetched successfully',
      data: {
        walletAddress: walletAddress,
        totalTransactions: allTransactionDetails.length,
        transactions: allTransactionDetails,
      },
    };
  }

  // Private function
  private async getStellarAssetBalances(walletAddress: string, server: Horizon.Server): Promise<any[]> {
    const logContext = '[StellarService.getStellarAssetBalances]';
    try {
      const account = await server.accounts().accountId(walletAddress).call();
      return account.balances;
    } catch (error) {
      logger.error(`${logContext} Failed to get balances: ${error instanceof Error ? error.message : error}`);

      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { status?: number } };
        if (httpError.response?.status === 404) {
          throw new HttpException(
            {
              status: 404,
              success: false,
              message: 'Wallet account not found',
              errorCode: 'ACCOUNT_NOT_FOUND',
              retryable: false,
              details: 'The wallet address does not exist on the Stellar network.',
            },
            404
          );
        }
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to retrieve wallet balances',
          errorCode: 'BALANCE_RETRIEVAL_FAILED',
          retryable: true,
          retryAfter: 5,
          details: 'An error occurred while retrieving wallet balances. Please retry the request.',
        },
        500
      );
    }
  }

  // Helper method to get operation descriptions
  private getOperationDescription(operationType: string, walletAddress: string, op: any): string {
    switch (operationType) {
      case 'payment':
        return op.from === walletAddress ? 'Payment Sent' : 'Payment Received';
      case 'change_trust':
        return 'Trustline Added';
      case 'create_account':
        return 'Account Created';
      case 'account_merge':
        return 'Account Merged';
      case 'set_options':
        return 'Account Settings Changed';
      case 'allow_trust':
        return 'Trust Authorization Changed';
      case 'path_payment_strict_send':
        return 'Path Payment Sent';
      case 'path_payment_strict_receive':
        return 'Path Payment Received';
      case 'manage_sell_offer':
        return 'Sell Offer';
      case 'create_passive_sell_offer':
        return 'Passive Sell Offer';
      case 'inflation':
        return 'Inflation Operation';
      case 'manage_data':
        return 'Data Entry Modified';
      case 'bump_sequence':
        return 'Sequence Bumped';
      default:
        return `Operation: ${operationType}`;
    }
  }

  /**
   * Sends a SYTEPLOT NFT to a buyer's wallet on the Stellar network.
   * 
   * This function performs the following operations:
   * 1. Validates environment configuration and Metadata inputs
   * 2. Extracts wallet credentials from Metadata (buyer_wallet_id and buyer_wallet_secret)
   * 3. Establishes a trustline for SYTEPLOT NFT using sponsorship (if not already exists)
   * 4. Sends the SYTEPLOT NFT payment from the distributor to the buyer's wallet
   * 
   * @param UserId - The ID of the user receiving the NFT
   * @param PlotId - The ID of the plot associated with this NFT
   * @param Metadata - Metadata object containing plot information and buyer wallet credentials
   *   - buyer_wallet_id: The Stellar public key (wallet address) of the buyer
   *   - buyer_wallet_secret: The encrypted secret key of the buyer's wallet
   *   - Other fields: Plot details (not used in this function but kept for compatibility)
   * @returns Promise resolving to transaction details including UserId, PlotId, and TransactionHash
   * @throws HttpException if validation fails, configuration is missing, or transaction fails
   */
  async sendSytePlotNft(
    UserId: number,
    PlotId: number,
    Metadata: {
      plot_no: number,
      estate_name: string,
      size_of_plot: number,
      plot_url: string,
      price_of_plot: number,
      date_of_allocation: string,
      coordinate_of_plot: string,
      buyer_wallet_id: string, // Used as the wallet address for NFT transfer
      buyer_wallet_secret: string, // Used as the encrypted secret key for wallet operations
      estate_company_name: string,
      property_verification_no: number,
    },
  
  ): Promise<{
    UserId: number;
    PlotId: number;
    TransactionHash: string;
  }> {
    const logContext = '[StellarService.sendSytePlotNft]';

    // Validate environment variables
    if (!process.env.STELLAR_HORIZON_URL) {
      logger.error(`${logContext} Missing STELLAR_HORIZON_URL`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'STELLAR_HORIZON_URL not configured',
          errorCode: 'CONFIG_MISSING_HORIZON_URL',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTE_DISTRIBUTOR_ADDRESS) {
      logger.error(`${logContext} Missing SYTE_DISTRIBUTOR_ADDRESS`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTE_DISTRIBUTOR_ADDRESS not configured',
          errorCode: 'CONFIG_MISSING_DISTRIBUTOR_ADDRESS',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTE_DISTRIBUTOR_PRIVATE_KEY) {
      logger.error(`${logContext} Missing SYTE_DISTRIBUTOR_PRIVATE_KEY`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTE_DISTRIBUTOR_PRIVATE_KEY not configured',
          errorCode: 'CONFIG_MISSING_DISTRIBUTOR_SECRET',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SPONSOR_PRIVATE_KEY) {
      logger.error(`${logContext} Missing SPONSOR_PRIVATE_KEY`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SPONSOR_PRIVATE_KEY not configured',
          errorCode: 'CONFIG_MISSING_SPONSOR_SECRET',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    // Validate SYTEPLOT NFT configuration
    if (!process.env.SYTEPLOT_ASSET_CODE) {
      logger.error(`${logContext} Missing SYTEPLOT_ASSET_CODE`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTEPLOT_ASSET_CODE not configured',
          errorCode: 'CONFIG_MISSING_SYTEPLOT_ASSET_CODE',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    if (!process.env.SYTEPLOT_ISSUER_ADDRESS) {
      logger.error(`${logContext} Missing SYTEPLOT_ISSUER_ADDRESS`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SYTEPLOT_ISSUER_ADDRESS not configured',
          errorCode: 'CONFIG_MISSING_SYTEPLOT_ISSUER_ADDRESS',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    // SYTEPLOT NFT configuration
    const SYTEPLOT_ASSET_CODE = process.env.SYTEPLOT_ASSET_CODE;
    const SYTEPLOT_ISSUER_ADDRESS = process.env.SYTEPLOT_ISSUER_ADDRESS;
    const SYTEPLOT_PAYMENT_AMOUNT = '0.0000001'; // 1 NFT (minimum amount for NFT transfer)
    const SYTEPLOT_TRUST_LIMIT = '0.0000001'; // NFT trust limit (minimum required for NFT)

    // Extract wallet credentials from Metadata
    // Note: The wallet address and encrypted secret key are sourced from Metadata,
    // not from function parameters, to maintain compatibility with the API structure
    const WalletAddressFromMetadata = Metadata.buyer_wallet_id;
    const encryptedSecretKeyFromMetadata = Metadata.buyer_wallet_secret;

    // Validate wallet address from Metadata
    if (!WalletAddressFromMetadata || typeof WalletAddressFromMetadata !== 'string') {
      logger.error(`${logContext} Invalid buyer_wallet_id in Metadata: ${WalletAddressFromMetadata}`);
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address',
          errorCode: 'INVALID_WALLET_ADDRESS',
          retryable: false,
          details: 'The provided wallet address is invalid or missing. Please provide a valid Stellar public key.',
        },
        400
      );
    }

    // Validate Stellar public key format
    if (!StrKey.isValidEd25519PublicKey(WalletAddressFromMetadata)) {
      logger.error(`${logContext} Invalid Stellar public key format: ${WalletAddressFromMetadata}`);
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Invalid wallet address format',
          errorCode: 'INVALID_WALLET_ADDRESS_FORMAT',
          retryable: false,
          details: 'The wallet address must be a valid Stellar public key (starts with G and is 56 characters long).',
        },
        400
      );
    }

    // Initialize Stellar Horizon server connection
    const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL);
    
    // Get sponsor public key for fee sponsorship operations
    const sponsorPubKey = process.env.SPONSOR_PUBLIC_KEY;
    if (!sponsorPubKey) {
      logger.error(`${logContext} Missing SPONSOR_PUBLIC_KEY`);
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'SPONSOR_PUBLIC_KEY not configured',
          errorCode: 'CONFIG_MISSING_SPONSOR_KEY',
          retryable: false,
          details: 'Server configuration error. Please contact support.',
        },
        500
      );
    }

    // Initialize keypairs for signing transactions
    // Sponsor keypair: Used to sponsor transaction fees and reserves
    // Distributor keypair: Used to send NFT payments from the distributor account
    const sponsorKeypair = Keypair.fromSecret(process.env.SPONSOR_PRIVATE_KEY);
    const distributorKeypair = Keypair.fromSecret(process.env.SYTE_DISTRIBUTOR_PRIVATE_KEY);

    // Validate encrypted secret key from Metadata
    if (!encryptedSecretKeyFromMetadata) {
      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Encrypted secret key is required',
          errorCode: 'MISSING_ENCRYPTED_SECRET_KEY',
          retryable: false,
          details: 'Encrypted secret key must be provided in Metadata.buyer_wallet_secret.',
        },
        400
      );
    }

    // Create SYTEPLOT asset object for Stellar operations
    const sytePlotAsset = new Asset(SYTEPLOT_ASSET_CODE, SYTEPLOT_ISSUER_ADDRESS);

    // Decrypt the buyer's encrypted secret key from Metadata
    // This is required to sign the trustline transaction on behalf of the buyer
    let secretKey: string;
    try {
      secretKey = await this.encryptionService.decryptSecretKey(encryptedSecretKeyFromMetadata);
      logger.debug(`${logContext} Secret key decrypted for wallet ${WalletAddressFromMetadata}`);
    } catch (error) {
      logger.error(`${logContext} Failed to decrypt secret key: ${error instanceof Error ? error.message : error}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to decrypt secret key',
          errorCode: 'SECRET_KEY_DECRYPTION_FAILED',
          retryable: false,
          details:
            'An error occurred while decrypting the secret key. Make sure the encrypted secret key is the one provided during account creation',
        },
        500
      );
    }

    // Validate that the decrypted secret key matches the provided wallet address
    // This ensures the secret key belongs to the correct wallet before proceeding
    try {
      const keypair = Keypair.fromSecret(secretKey);
      const derivedPublicKey = keypair.publicKey();

      if (derivedPublicKey !== WalletAddressFromMetadata) {
        logger.error(`${logContext} Secret key mismatch. Wallet: ${WalletAddressFromMetadata}, Derived: ${derivedPublicKey}`);
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Secret key does not match wallet address',
            errorCode: 'SECRET_KEY_MISMATCH',
            retryable: false,
            details:
              'The provided encrypted secret key does not belong to the specified wallet address. Please ensure the secret key matches the wallet address.',
          },
          400
        );
      }
      logger.debug(`${logContext} Secret key validated - matches wallet address`);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle invalid secret key format
      if (
        error instanceof Error &&
        (error.message.includes('Invalid secret key') || error.message.includes('invalid'))
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Invalid secret key format',
            errorCode: 'INVALID_SECRET_KEY_FORMAT',
            retryable: false,
            details: 'The decrypted secret key is not a valid Stellar secret key format.',
          },
          400
        );
      }

      throw new HttpException(
        {
          status: 400,
          success: false,
          message: 'Secret key validation failed',
          errorCode: 'SECRET_KEY_VALIDATION_FAILED',
          retryable: false,
          details: 'Failed to validate the secret key. Please check that the encrypted secret key is correct.',
        },
        400
      );
    }

    try {
      /**
       * Step 1: Establish trustline for SYTEPLOT NFT
       * 
       * Before a wallet can receive an asset on Stellar, it must establish a trustline.
       * This operation uses sponsorship to pay for the trustline reserves, so the buyer
       * doesn't need to have XLM in their account. Both the sponsor and buyer must sign.
       */
      logger.debug(`${logContext} Step 1: Adding trustline for SYTEPLOT NFT for ${WalletAddressFromMetadata}`);

      // Check if trustline already exists and if account already has the NFT
      try {
        const account = await server.loadAccount(WalletAddressFromMetadata);
        const trustlineExists = account.balances.some(
          (balance: any) =>
            balance.asset_type !== 'native' &&
            balance.asset_code === SYTEPLOT_ASSET_CODE &&
            balance.asset_issuer === SYTEPLOT_ISSUER_ADDRESS
        );

        if (trustlineExists) {
          // Check if account already has the NFT (balance equals the limit)
          const nftBalance = account.balances.find(
            (balance: any) =>
              balance.asset_type !== 'native' &&
              balance.asset_code === SYTEPLOT_ASSET_CODE &&
              balance.asset_issuer === SYTEPLOT_ISSUER_ADDRESS
          );

          if (nftBalance && parseFloat(nftBalance.balance) >= parseFloat(SYTEPLOT_TRUST_LIMIT)) {
            logger.info(`${logContext} Account already has SYTEPLOT NFT: ${WalletAddressFromMetadata}`);
            throw new HttpException(
              {
                status: 400,
                success: false,
                message: 'NFT already received',
                errorCode: 'NFT_ALREADY_RECEIVED',
                retryable: false,
                details:
                  'The destination wallet already has the SYTEPLOT NFT. Each wallet can only hold one NFT per trustline. The trustline limit has been reached.',
              },
              400
            );
          }
          logger.info(`${logContext} SYTEPLOT NFT trustline already exists for ${WalletAddressFromMetadata}`);
        } else {
          // Build trustline transaction with sponsorship
          // The sponsor pays for reserves, but the buyer must sign to authorize the trustline
          const userKeypair = Keypair.fromSecret(secretKey);
          const sourceAccount = await server.loadAccount(sponsorPubKey);
          const trustlineTransaction = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: this.params.networkPassphrase,
          })
            .addOperation(
              Operation.beginSponsoringFutureReserves({
                sponsoredId: WalletAddressFromMetadata,
              })
            )
            .addOperation(
              Operation.changeTrust({
                source: WalletAddressFromMetadata,
                asset: sytePlotAsset,
                limit: SYTEPLOT_TRUST_LIMIT,
              })
            )
            .addOperation(
              Operation.endSponsoringFutureReserves({
                source: WalletAddressFromMetadata,
              })
            )
            .setTimeout(180)
            .build();

          // Both sponsor and buyer must sign: sponsor for fee sponsorship, buyer for trustline authorization
          trustlineTransaction.sign(sponsorKeypair);
          trustlineTransaction.sign(userKeypair);
          logger.debug(`${logContext} Trustline transaction built and signed by both sponsor and user`);

          await server.submitTransaction(trustlineTransaction);
          logger.info(`${logContext} SYTEPLOT NFT trustline added successfully for ${WalletAddressFromMetadata}`);
        }
      } catch (accountError) {
        // If account doesn't exist, we'll let the transaction fail with a more specific error
        if (accountError instanceof Error && accountError.message.includes('404')) {
          logger.error(`${logContext} Account does not exist on Stellar network: ${WalletAddressFromMetadata}`);
          throw new HttpException(
            {
              status: 404,
              success: false,
              message: 'Account does not exist on Stellar network',
              errorCode: 'ACCOUNT_NOT_FOUND',
              retryable: false,
              details:
                'The wallet address does not exist on the Stellar network. Please ensure the account has been created on-chain before adding the trustline.',
            },
            404
          );
        }
        logger.debug(
          `${logContext} Could not check account status: ${accountError instanceof Error ? accountError.message : accountError}`
        );
        // Continue to try adding trustline even if check failed
      }

      /**
       * Step 2: Send SYTEPLOT NFT payment from distributor to buyer
       * 
       * The distributor account sends the NFT to the buyer's wallet.
       * The transaction uses fee-bumping so the sponsor pays the transaction fee,
       * allowing the operation to proceed even if the distributor has minimal XLM.
       */
      logger.debug(`${logContext} Step 2: Sending SYTEPLOT NFT payment from distributor to ${WalletAddressFromMetadata}`);

      // Load distributor account for the payment transaction
      let distributorAccount;
      try {
        distributorAccount = await server.loadAccount(process.env.SYTE_DISTRIBUTOR_ADDRESS);
      } catch (accountError) {
        if (accountError instanceof Error && (accountError.message.includes('404') || accountError.message.includes('Not Found'))) {
          logger.error(`${logContext} Distributor account does not exist on Stellar network: ${process.env.SYTE_DISTRIBUTOR_ADDRESS}`);
          throw new HttpException(
            {
              status: 500,
              success: false,
              message: 'Distributor account not found on Stellar network',
              errorCode: 'DISTRIBUTOR_ACCOUNT_NOT_FOUND',
              retryable: false,
              details: `The distributor account (${process.env.SYTE_DISTRIBUTOR_ADDRESS}) does not exist on the Stellar network. Please ensure the account has been created and funded.`,
            },
            500
          );
        }
        throw accountError;
      }

      // Build payment transaction: distributor sends NFT to buyer
      const paymentTransaction = new TransactionBuilder(distributorAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.params.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: WalletAddressFromMetadata,
            asset: sytePlotAsset,
            amount: SYTEPLOT_PAYMENT_AMOUNT,
          })
        )
        .setTimeout(180)
        .build();

      // Sign with distributor keypair (the sender)
      paymentTransaction.sign(distributorKeypair);

      // Build fee-bump transaction: sponsor pays the transaction fee
      // This allows the transaction to succeed even if distributor has minimal XLM balance
      const feeBumpTransaction = TransactionBuilder.buildFeeBumpTransaction(
        sponsorKeypair,
        (Number(BASE_FEE) * 2).toString(), // Fee-bump requires double the base fee
        paymentTransaction,
        this.params.networkPassphrase
      );

      // Sign the fee-bump transaction with sponsor keypair
      feeBumpTransaction.sign(sponsorKeypair);

      // Submit the fee-bumped transaction to the Stellar network
      const result = await server.submitTransaction(feeBumpTransaction);
      logger.info(`${logContext} SYTEPLOT NFT sent successfully. Hash: ${result.hash}`);

      // Return transaction details for tracking and verification
      return {
        UserId: UserId,
        PlotId: PlotId,
        TransactionHash: result.hash, // Stellar transaction hash for blockchain verification
      };
    } catch (error) {
      /**
       * Error Handling: Comprehensive error handling for Stellar transaction failures
       * 
       * This section handles various Stellar-specific errors and provides meaningful
       * error messages to help diagnose issues with NFT transfers.
       */
      logger.error(`${logContext} Failed to send SYTEPLOT NFT: ${error instanceof Error ? error.message : error}`);

      // Re-throw HttpException errors as-is (they're already properly formatted)
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle invalid destination error
      if (error instanceof Error && error.message.includes('destination is invalid')) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Invalid wallet address',
            errorCode: 'INVALID_DESTINATION_ADDRESS',
            retryable: false,
            details:
              'The provided wallet address is not a valid Stellar public key. Please check the address and try again.',
          },
          400
        );
      }

      const errorDetails = (
        error as { response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } } }
      )?.response?.data?.extras;
      const operations = errorDetails?.result_codes?.operations;

      // Check error message as fallback
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);

      // Handle "Not Found" errors (could be account, asset issuer, or other resources)
      if (
        errorMessage.includes('Not Found') ||
        errorMessage.includes('404') ||
        errorString.includes('Not Found') ||
        errorString.includes('404')
      ) {
        // Check if it's the asset issuer
        if (errorMessage.includes('asset') || errorMessage.includes('issuer') || errorString.includes('asset') || errorString.includes('issuer')) {
          throw new HttpException(
            {
              status: 500,
              success: false,
              message: 'SYTEPLOT asset issuer not found',
              errorCode: 'ASSET_ISSUER_NOT_FOUND',
              retryable: false,
              details: `The SYTEPLOT asset issuer address (${process.env.SYTEPLOT_ISSUER_ADDRESS}) does not exist on the Stellar network. Please verify the issuer address is correct.`,
            },
            500
          );
        }
        
        // Generic "Not Found" error
        throw new HttpException(
          {
            status: 404,
            success: false,
            message: 'Resource not found on Stellar network',
            errorCode: 'STELLAR_RESOURCE_NOT_FOUND',
            retryable: false,
            details: 'A required resource (account, asset, or issuer) was not found on the Stellar network. Please verify all addresses are correct and accounts exist on-chain.',
          },
          404
        );
      }

      // Handle case where trustline limit is full (account already has the NFT)
      if (
        (operations && operations.includes('op_line_full')) ||
        errorMessage.includes('op_line_full') ||
        errorString.includes('op_line_full')
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'NFT already received',
            errorCode: 'NFT_ALREADY_RECEIVED',
            retryable: false,
            details:
              'The destination wallet already has the SYTEPLOT NFT. Each wallet can only hold one NFT per trustline. The trustline limit has been reached.',
          },
          400
        );
      }

      // Handle case where destination account doesn't have trustline for SYTEPLOT NFT
      if (
        (operations && operations.includes('op_no_trust')) ||
        errorMessage.includes('op_no_trust') ||
        errorString.includes('op_no_trust')
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Trustline not established',
            errorCode: 'NO_TRUSTLINE',
            retryable: false,
            details:
              'The destination wallet does not have a trustline for SYTEPLOT NFT. The trustline setup failed or was not completed.',
          },
          400
        );
      }

      // Handle insufficient balance
      if (
        (operations && operations.includes('op_underfunded')) ||
        errorMessage.includes('op_underfunded') ||
        errorString.includes('op_underfunded')
      ) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Service not available',
            errorCode: 'INSUFFICIENT_FUNDS',
            retryable: false,
            details: 'The distributor account has insufficient funds to send SYTEPLOT NFT.',
          },
          400
        );
      }

      // Handle case where destination account doesn't exist
      if (operations && operations.includes('op_no_account')) {
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Account does not exist',
            errorCode: 'ACCOUNT_NOT_FOUND',
            retryable: false,
            details:
              'The destination wallet address does not exist on the Stellar network. Please verify the wallet address.',
          },
          400
        );
      }

      // Handle other Stellar operation errors
      if (operations && operations.length > 0) {
        const errorMessage = operations.join(', ');
        throw new HttpException(
          {
            status: 400,
            success: false,
            message: 'Transaction failed',
            errorCode: 'STELLAR_OPERATION_ERROR',
            retryable: true,
            retryAfter: 5,
            details: `Stellar operation error: ${errorMessage}`,
          },
          400
        );
      }

      // Throw generic error if no specific handling
      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to send SYTEPLOT NFT',
          errorCode: 'NFT_SEND_FAILED',
          retryable: true,
          retryAfter: 5,
          details:
            error instanceof Error
              ? error.message
              : 'An error occurred while sending SYTEPLOT NFT. Please retry the request.',
        },
        500
      );
    }
  }
}

// Export singleton instance
export default new StellarService();
