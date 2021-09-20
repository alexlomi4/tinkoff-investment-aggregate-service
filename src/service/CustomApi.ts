import OpenAPI, {
  CurrencyPosition,
  Operation,
  PortfolioPosition,
  UserAccount,
  UserAccounts,
} from 'tinkoff-investment-js-client-api';
import CashHelper from '../utils/CacheHelper';

type CustomOpenApiConfig = {
  isProd: boolean;
  secretToken: string;
};

class CustomApi extends OpenAPI {
  private readonly token: string;

  constructor({ isProd, secretToken }: CustomOpenApiConfig) {
    super({
      apiURL: isProd
        ? 'https://api-invest.tinkoff.ru/openapi'
        : 'https://api-invest.tinkoff.ru/openapi/sandbox',
      secretToken,
      socketURL: 'wss://api-invest.tinkoff.ru/openapi/md/v1/md-openapi/ws',
    });
    this.token = secretToken;
  }

  private getKeyForRequest(prefix: string, accountPrefix = false): string {
    return `${prefix}_${this.token}_${
      accountPrefix ? this.getCurrentAccountId() : ''
    }`;
  }

  async getAccounts(): Promise<UserAccount[]> {
    const { accounts } = await CashHelper.withPromiseCache<UserAccounts>(
      () => this.accounts(),
      this.getKeyForRequest('accounts')
    );
    return accounts;
  }

  async getOperations(
    from: string = new Date('1970-01-01').toISOString(),
    to: string = new Date().toISOString()
  ): Promise<Operation[]> {
    const { operations } = await CashHelper.withPromiseCache(
      () =>
        this.operations({
          from,
          to,
        }),
      this.getKeyForRequest('operations', true)
    );
    return operations.filter(
      ({ status, operationType }) =>
        status !== 'Decline' && operationType !== 'BrokerCommission'
    );
  }

  async getLastPrice(figi: string): Promise<number> {
    return CashHelper.withPromiseCache<number>(
      async () => {
        const { lastPrice = 0 } = await this.orderbookGet({
          figi,
        });
        return lastPrice;
      },
      this.getKeyForRequest(`lastPrice_${figi}`),
      3e3
    );
  }

  async getPortfolio(): Promise<PortfolioPosition[]> {
    const { positions: currentAccountPositions } =
      await CashHelper.withPromiseCache(
        () => this.portfolio(),
        this.getKeyForRequest('portfolio', true)
      );
    return currentAccountPositions;
  }

  async getPortfolioCurrencies(): Promise<CurrencyPosition[]> {
    const { currencies: currentAccountCurrencies } =
      await CashHelper.withPromiseCache(
        () => this.portfolioCurrencies(),
        this.getKeyForRequest('portfolioCurrencies', true)
      );
    return currentAccountCurrencies;
  }
}

export default CustomApi;
