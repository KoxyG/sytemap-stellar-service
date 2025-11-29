import { Request, Response, NextFunction } from 'express';

import stellarService from '../stellar/stellar.service';

class StellarController {
  /**
   * POST
   * Generates a mnemonic phrase, derives a keypair from it, creates a new Stellar account,
   * and returns account details including the mnemonic.
   */
  async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { UserId, UserEmail, Username, DeveloperId, BlockchainType, BlockchainAction } = req.body as {
        UserId: number;
        UserEmail: string;
        Username: string;
        DeveloperId: number;
        BlockchainType: 'STELLAR';
        BlockchainAction: 'CREATE';
      };

      const result = await stellarService.generateAndCreateAccount(
        UserId,
        UserEmail,
        Username,
        DeveloperId,
        BlockchainType,
        BlockchainAction
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST
   * Sends SYTE tokens to a specified wallet address.
   */
  async sendSyteTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { UserId, DeveloperId, WalletAddress, AmountPaid } = req.body as {
        UserId: number;
        DeveloperId: number;
        WalletAddress: string;
        AmountPaid: number;
      };

      const result = await stellarService.sendSyteTokens(UserId, DeveloperId, WalletAddress, AmountPaid);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET
   * Get wallet details and balances for a Stellar wallet address.
   */
  async getStellarWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletAddress } = req.query as {
        walletAddress: string;
      };

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          message: 'Wallet address is required',
          errorCode: 'MISSING_WALLET_ADDRESS',
        });
        return;
      }

      const result = await stellarService.GetStellarWallet(walletAddress);

      res.status(result.status).json({
        success: result.success,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET
   * Get all transaction history for a Stellar wallet address.
   */
  async getStellarAllTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletAddress } = req.query as {
        walletAddress: string;
      };

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          message: 'Wallet address is required',
          errorCode: 'MISSING_WALLET_ADDRESS',
        });
        return;
      }

      const result = await stellarService.getStellarAllTransactionHistory(walletAddress);

      res.status(result.status).json({
        success: result.success,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST
   * Admin function to activate SYTE token trustline for a wallet address.
   * 
   * IMPORTANT: Only use this function if you are certain that:
   * - The account already exists on the Stellar network (on-chain)
   * - The account only lacks the SYTE token trustline activation
   * 
   * This function will fail if the account does not exist on-chain.
   */
  async activateSyteTokenTrustline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { WalletAddress, EncryptedSecretKey } = req.body as {
        WalletAddress: string;
        EncryptedSecretKey: string;
      };

      const result = await stellarService.activateSyteTokenTrustline(WalletAddress, EncryptedSecretKey);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StellarController();
