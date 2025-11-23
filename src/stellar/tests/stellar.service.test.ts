import { HttpException } from '../../exceptions/http.exception';

jest.mock('../../encryption/encryption.service', () => ({
  __esModule: true,
  default: {
    encryptSecretKey: jest.fn(),
  },
}));

jest.mock('../../utils/logger.utils', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockTransaction = { sign: jest.fn() };
const mockBuilderInstance = {
  addOperation: jest.fn().mockReturnThis(),
  setTimeout: jest.fn().mockReturnThis(),
  build: jest.fn().mockReturnValue(mockTransaction),
};

const mockServerInstance = {
  loadAccount: jest.fn().mockResolvedValue({ id: 'sponsor-account' }),
  submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx-hash' }),
};

jest.mock('@stellar/stellar-sdk', () => ({
  BASE_FEE: '100',
  Networks: { PUBLIC: 'PUBLIC', TESTNET: 'TESTNET' },
  Keypair: {
    random: jest.fn(),
    fromSecret: jest.fn(),
  },
  Horizon: {
    Server: jest.fn(() => mockServerInstance),
  },
  Operation: {
    beginSponsoringFutureReserves: jest.fn().mockReturnValue({ op: 'begin' }),
    createAccount: jest.fn().mockReturnValue({ op: 'create' }),
    endSponsoringFutureReserves: jest.fn().mockReturnValue({ op: 'end' }),
    changeTrust: jest.fn().mockReturnValue({ op: 'change' }),
  },
  TransactionBuilder: jest.fn(() => mockBuilderInstance),
}));

const mockWallet = {
  getKeypair: jest.fn().mockReturnValue({
    publicKey: jest.fn().mockReturnValue('PUBLIC'),
    secret: jest.fn().mockReturnValue('SECRET'),
  }),
};

jest.mock('stellar-hd-wallet', () => ({
  __esModule: true,
  default: {
    generateMnemonic: jest.fn().mockReturnValue('test mnemonic phrase for wallet generation'),
    fromMnemonic: jest.fn().mockReturnValue(mockWallet),
  },
}));

describe('StellarService.generateAndCreateAccount', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockTransaction.sign.mockClear();
    mockBuilderInstance.addOperation.mockClear();
    mockBuilderInstance.setTimeout.mockClear();
    mockBuilderInstance.build.mockClear();
    mockServerInstance.loadAccount.mockClear();
    mockServerInstance.submitTransaction.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadService = async () => (await import('../stellar.service')).default;

  it('throws when STELLAR_HORIZON_URL is missing', async () => {
    process.env = {
      ...process.env,
      SPONSOR_PUBLIC_KEY: 'SPONSOR_PUB',
      SPONSOR_PRIVATE_KEY: 'SPONSOR_PRIV',
    };
    delete process.env.STELLAR_HORIZON_URL;

    const stellarService = await loadService();

    await expect(
      stellarService.generateAndCreateAccount(
        1,
        'test@example.com',
        'testuser',
        1,
        'STELLAR',
        'CREATE'
      )
    ).rejects.toThrow('Failed to generate and create account');
  });

  it('creates account, encrypts secret and adds trustline', async () => {
    process.env = {
      ...process.env,
      SPONSOR_PUBLIC_KEY: 'SPONSOR_PUB',
      SPONSOR_PRIVATE_KEY: 'SPONSOR_PRIV',
      STELLAR_HORIZON_URL: 'https://horizon.test',
      SYTE_ASSET_CODE: 'SYTE',
      SYTE_ASSET_ISSUER: 'ISSUER',
      NODE_ENV: 'test',
    };

    const StellarSdk = jest.requireMock('@stellar/stellar-sdk');
    const mockKeypair = {
      secret: jest.fn().mockReturnValue('SECRET'),
      publicKey: jest.fn().mockReturnValue('PUBLIC'),
    };
    (StellarSdk.Keypair.fromSecret as jest.Mock).mockReturnValue(mockKeypair);

    const encryptionService = (await import('../../encryption/encryption.service')).default as unknown as {
      encryptSecretKey: jest.Mock;
    };
    encryptionService.encryptSecretKey.mockResolvedValue('encrypted-secret');

    const stellarService = await loadService();
    const addTrustlineSpy = jest
      .spyOn(stellarService as unknown as { addTrustline: jest.Mock }, 'addTrustline')
      .mockResolvedValue(undefined);
    const result = await stellarService.generateAndCreateAccount(
      1,
      'test@example.com',
      'testuser',
      1,
      'STELLAR',
      'CREATE'
    );

    expect(result).toEqual({
      UserId: 1,
      WalletAddress: 'PUBLIC',
      WalletSecret: 'encrypted-secret',
      WalletMnemonic: expect.any(String),
      ActivationStatus: true,
      DeveloperId: 1,
      BlockchainType: 'STELLAR',
      BlockchainAction: 'CREATE',
    });
    expect(encryptionService.encryptSecretKey).toHaveBeenCalledWith('SECRET');
    expect(addTrustlineSpy).toHaveBeenCalledWith('PUBLIC', 'SECRET');
    expect(mockServerInstance.submitTransaction).toHaveBeenCalled();
    expect(mockTransaction.sign).toHaveBeenCalledTimes(2);
  });
});
