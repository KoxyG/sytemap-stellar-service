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
}

export default new StellarController();
