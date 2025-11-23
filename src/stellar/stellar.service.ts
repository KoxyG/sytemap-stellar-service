import { Asset, Keypair, Horizon, BASE_FEE, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
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
    BlockchainType: "STELLAR",
    BlockchainAction: "CREATE"
  ): Promise<{
    UserId: number;
    WalletAddress: string;
    WalletSecret: string;
    WalletMnemonic: string;
    ActivationStatus: boolean;
    DeveloperId: number;
    BlockchainType: "STELLAR";
    BlockchainAction: "CREATE";
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

  /**
   * Get and decrypted secret key for a user
   * @param userUuid - The UUID of the user
   * @returns Decrypted secret key
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getSecretKey(userUuid: string): Promise<string> {
    // TODO: Implement database query to get encrypted secret key for userUuid
    // ASK FOR AN ENDPOINT THAT CAN RETURN THE SECRET KEY FOR A USER IN THE DATABASE.

    try {
      // TODO: Replace with actual database query
      // const user = await this.databaseService.stellar.findUnique({
      //   where: { owner_uuid: userUuid },
      //   select: { secret_key: true },
      // });

      // Temporary placeholder - replace with actual database implementation
      throw new HttpException(
        {
          status: 501,
          success: false,
          message: 'Database integration not implemented yet',
          errorCode: 'FEATURE_NOT_IMPLEMENTED',
          retryable: false,
          details: 'This feature is not yet implemented. Please contact support.',
        },
        501
      );

      // TODO: Uncomment when database is ready
      // if (!user || !user.secret_key) {
      //   throw new HttpException(
      //     {
      //       status: 404,
      //       success: false,
      //       message: 'Secret key not found for user',
      //     },
      //     404,
      //   );
      // }

      // const decryptedSecret = await this.encryptionService.decryptSecretKey(
      //   user.secret_key,
      // );
      // return decryptedSecret;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 500,
          success: false,
          message: 'Failed to retrieve secret key',
          errorCode: 'SECRET_KEY_RETRIEVAL_FAILED',
          retryable: true,
          retryAfter: 3,
          details: 'An error occurred while retrieving the secret key. Please retry the request.',
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
      const userKeypair = Keypair.fromSecret(decryptedSecret);
      logger.debug(`${logContext} Prepared trustline transaction context for ${publicKey}`);

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

      await server.submitTransaction(transaction);
      logger.info(`Trustline added successfully for account: ${publicKey}`);
    } catch (error) {
      logger.error(
        `${logContext} Failed to add trustline for ${publicKey}: ${error instanceof Error ? error.message : error}`
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
                'The sponsor account does not have enough funds to add the trustline. This is a permanent error.',
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
        } else if (error.message.includes('op_no_trust')) {
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
          message: 'Failed to add trustline',
          errorCode: 'TRUSTLINE_ADDITION_FAILED',
          retryable: true,
          retryAfter: 5,
          details: 'An unexpected error occurred while adding the trustline. Please retry the request.',
        },
        500
      );
    }
  }
}

// Export singleton instance
export default new StellarService();
