import OpenAPI, {
  CurrencyPosition,
  Operation,
  PortfolioPosition,
  UserAccount,
  UserAccounts,
} from 'tinkoff-investment-js-client-api';
import CashStorage from '../utils/CacheStorage';
import {
  InstrumentPriceInfo,
  PortfolioPositionWithPrice,
  PortfolioPositionWithTotalPrices,
} from '../types/model';
import {
  convertToAggregatedCurrencyPositions,
  convertToAggregatedInstrumentPositions,
  convertToPositionWithTotalPrices,
} from './helpers';

class OpenAPIProxy extends OpenAPI {
  private readonly token: string;

  private readonly isProd: boolean;

  constructor({ isProd, token }: { isProd: boolean; token: string }) {
    super({
      apiURL: isProd
        ? 'https://api-invest.tinkoff.ru/openapi'
        : 'https://api-invest.tinkoff.ru/openapi/sandbox',
      secretToken: token,
      socketURL: 'wss://api-invest.tinkoff.ru/openapi/md/v1/md-openapi/ws',
    });
    this.isProd = isProd;
    this.token = token;
  }

  clone(): OpenAPIProxy {
    return new OpenAPIProxy({
      isProd: this.isProd,
      token: this.token,
    });
  }

  private getKeyForRequest(prefix: string, accountPrefix = false): string {
    return `${prefix}_${this.token}_${
      accountPrefix ? this.getCurrentAccountId() : ''
    }`;
  }

  async getAccounts(): Promise<UserAccount[]> {
    const { accounts } = await CashStorage.withPromiseCache<UserAccounts>(
      () => this.accounts(),
      this.getKeyForRequest('accounts')
    );
    return accounts;
  }

  private async getOperations({
    from,
    to,
    figi,
  }: {
    figi?: string;
    from?: string;
    to?: string;
  } = {}): Promise<Operation[]> {
    const { operations } = await CashStorage.withPromiseCache(
      () =>
        this.operations({
          // 1970
          from: from ?? new Date(0).toISOString(),
          to: to ?? new Date().toISOString(),
          figi,
        }),
      this.getKeyForRequest(`operations_${figi ?? ''}`, true)
    );
    return operations.filter(
      ({ status, operationType }) =>
        status !== 'Decline' && operationType !== 'BrokerCommission'
    );
  }

  async getLastPrice(figi: string): Promise<number> {
    return CashStorage.withPromiseCache<number>(
      async () => {
        const { lastPrice = 0 } = await this.orderbookGet({
          figi,
        });
        console.log(`figi, lastPrice: ${figi} ${lastPrice}`);
        return lastPrice;
      },
      this.getKeyForRequest(`lastPrice_${figi}`),
      3e3
    );
  }

  private async getPortfolio(): Promise<{
    positions: PortfolioPosition[];
    pricesInfo: InstrumentPriceInfo[];
  }> {
    const { positions: currentAccountPositions } =
      await CashStorage.withPromiseCache(
        () => this.portfolio(),
        this.getKeyForRequest('portfolio', true)
      );
    const pricesInfo = await Promise.all(
      currentAccountPositions
        .map(({ figi }) => figi)
        .map(async (figi) => {
          const lastPrice = await this.getLastPrice(figi);
          return {
            lastPrice,
            figi,
          };
        })
    );
    return {
      positions: currentAccountPositions,
      pricesInfo,
    };
  }

  private async getPortfolioCurrencies(): Promise<CurrencyPosition[]> {
    const { currencies: currentAccountCurrencies } =
      await CashStorage.withPromiseCache(
        () => this.portfolioCurrencies(),
        this.getKeyForRequest('portfolioCurrencies', true)
      );
    return currentAccountCurrencies;
  }

  async getAggregatedOperations(
    accountIds: string[],
    figi?: string
  ): Promise<Operation[]> {
    const operations = await Promise.all(
      accountIds.map((accId) => {
        const clonedService = this.clone();
        clonedService.setCurrentAccountId(accId);
        return clonedService.getOperations({
          figi,
        });
      })
    );
    return ([] as Operation[]).concat(...operations);
  }

  async getAggregatedPortfolio(
    accountIds: string[]
  ): Promise<PortfolioPositionWithPrice[]> {
    const results = await Promise.all(
      accountIds.map((accId) => {
        const clonedService = this.clone();
        clonedService.setCurrentAccountId(accId);
        return clonedService.getPortfolio();
      })
    );
    return convertToAggregatedInstrumentPositions(
      results.map(({ positions }) => positions),
      results.reduce(
        (priceInfo, { pricesInfo }) => priceInfo.concat(pricesInfo),
        [] as InstrumentPriceInfo[]
      )
    );
  }

  async getAggregatedPositionTotalDetails(
    figi: string,
    accountIds: string[]
  ): Promise<PortfolioPositionWithTotalPrices | null> {
    const portfolio = await this.getAggregatedPortfolio(accountIds);
    const position = portfolio.find(
      ({ figi: positionFigi }) => positionFigi === figi
    );
    if (!position) {
      return null;
    }
    const operations = await this.getAggregatedOperations(accountIds, figi);

    return convertToPositionWithTotalPrices(position, operations);
  }

  async getAggregatedPortfolioCurrencies(
    accountIds: string[]
  ): Promise<CurrencyPosition[]> {
    const currencyPositions = await Promise.all(
      accountIds.map((accId) => {
        const clonedService = this.clone();
        clonedService.setCurrentAccountId(accId);
        return clonedService.getPortfolioCurrencies();
      })
    );
    return convertToAggregatedCurrencyPositions(currencyPositions);
  }
}

export default OpenAPIProxy;
