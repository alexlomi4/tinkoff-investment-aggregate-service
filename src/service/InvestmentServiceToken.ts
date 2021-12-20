// eslint-disable-next-line max-classes-per-file
import {
  Currency,
  CurrencyPosition,
  UserAccount,
} from 'tinkoff-investment-js-client-api';
import {
  InstrumentPriceInfo,
  PortfolioPositionWithPrice,
  PortfolioPositionWithTotalPrices,
  Totals,
} from '../types/model';
import OpenAPIProxy from '../api/OpenAPIProxy';
import { getUniqueFigiInfoByCurrency } from './utils/currency-utils';
import { getPortfolioTotals } from './utils/total-utils';
import { instrumentToEmptyPosition } from './utils/converters';

type PositionsResponse = {
  positions: PortfolioPositionWithPrice[];
  currencyPositions: CurrencyPosition[];
};

interface InvestmentService {
  getAccounts(): Promise<UserAccount[]>;
  getCurrentPositions(brokerAccountId?: string): Promise<PositionsResponse>;
  getPortfolioTotal(brokerAccountId?: string): Promise<Totals>;
  getPositionTotalDetails(
    figi: string,
    brokerAccountId?: string
  ): Promise<PortfolioPositionWithTotalPrices | null>;
  getHistoricPositions(
    brokerAccountId?: string
  ): Promise<PortfolioPositionWithPrice[]>;
}

class InvestmentServiceStub implements InvestmentService {
  // eslint-disable-next-line class-methods-use-this
  getAccounts(): Promise<UserAccount[]> {
    return Promise.resolve([]);
  }

  // eslint-disable-next-line class-methods-use-this
  getCurrentPositions(): Promise<PositionsResponse> {
    return Promise.resolve({ positions: [], currencyPositions: [] });
  }

  // eslint-disable-next-line class-methods-use-this
  getPortfolioTotal(): Promise<Totals> {
    return Promise.resolve({ profit: 0, profitPercent: 0, payIn: 0 });
  }

  // eslint-disable-next-line class-methods-use-this
  getPositionTotalDetails(): Promise<PortfolioPositionWithTotalPrices | null> {
    return Promise.resolve(null);
  }

  // eslint-disable-next-line class-methods-use-this
  getHistoricPositions(): Promise<PortfolioPositionWithPrice[]> {
    return Promise.resolve([]);
  }
}

class InvestmentServiceToken implements InvestmentService {
  private readonly api: OpenAPIProxy;

  constructor(token: string, isProd = true) {
    this.api = new OpenAPIProxy({ isProd, token });
  }

  async getAccounts(): Promise<UserAccount[]> {
    return this.api.getAccounts();
  }

  private async getAccountIds(): Promise<string[]> {
    const accounts = await this.api.getAccounts();
    return accounts.map(({ brokerAccountId }) => brokerAccountId);
  }

  async getCurrentPositions(
    brokerAccountId?: string
  ): Promise<PositionsResponse> {
    const accountIds = brokerAccountId
      ? [brokerAccountId]
      : await this.getAccountIds();

    const [positions, currencyPositions] = await Promise.all([
      this.api.getAggregatedPortfolio(accountIds),
      this.api.getAggregatedPortfolioCurrencies(accountIds),
    ]);

    return {
      positions,
      currencyPositions,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async getHistoricPositions(
    brokerAccountId?: string
  ): Promise<PortfolioPositionWithTotalPrices[]> {
    const accountIds = brokerAccountId
      ? [brokerAccountId]
      : await this.getAccountIds();

    // operations are enough maybe
    const [positions, operations] = await Promise.all([
      this.api.getAggregatedPortfolio(accountIds),
      this.api.getAggregatedOperations(accountIds),
    ]);
    const oldPositionsFigi = operations.filter(
      ({ operationType, figi }) =>
        operationType &&
        figi &&
        !positions.find(({ figi: positionFigi }) => positionFigi === figi) &&
        ['Buy', 'Sell'].includes(operationType)
    );
    const historicPositions = await Promise.all(
      (
        Array.from(
          new Set(oldPositionsFigi.map(({ figi }) => figi))
        ) as string[]
      ).map(async (figi) => {
        const instrument = await this.api.searchOne({ figi });
        if (!instrument) return null;
        return instrumentToEmptyPosition(instrument, operations);
      })
    );

    return historicPositions.filter(
      Boolean
    ) as PortfolioPositionWithTotalPrices[];
  }

  private async getPriceInfo({
    instrumentsFigi,
    currencies,
  }: {
    instrumentsFigi: string[];
    currencies: Currency[];
  }): Promise<InstrumentPriceInfo[]> {
    const currencyFigis = getUniqueFigiInfoByCurrency(
      // currencies of portfolio operations / instruments + portfolio currency positions
      currencies
    ).map(({ figi }) => figi);
    const figis = [...currencyFigis, ...instrumentsFigi];

    return Promise.all(
      figis.map(async (figi) => {
        const lastPrice = await this.api.getLastPrice(figi);
        return { figi, lastPrice };
      })
    );
  }

  async getPositionTotalDetails(
    figi: string,
    brokerAccountId?: string
  ): Promise<PortfolioPositionWithTotalPrices | null> {
    const accountIds = brokerAccountId
      ? [brokerAccountId]
      : await this.getAccountIds();

    return this.api.getAggregatedPositionTotalDetails(figi, accountIds);
  }

  async getPortfolioTotal(brokerAccountId?: string): Promise<Totals> {
    const accountIds = brokerAccountId
      ? [brokerAccountId]
      : await this.getAccountIds();

    // operations are enough maybe
    const [positions, operations, currencyPositions] = await Promise.all([
      this.api.getAggregatedPortfolio(accountIds),
      this.api.getAggregatedOperations(accountIds),
      this.api.getAggregatedPortfolioCurrencies(accountIds),
    ]);

    const instrumentsPriceInfo = await this.getPriceInfo({
      instrumentsFigi: positions.map(({ figi }) => figi),
      currencies: [
        ...currencyPositions.map(({ currency }) => currency),
        ...operations.map(({ currency }) => currency),
      ],
    });

    return getPortfolioTotals({
      instrumentsPriceInfo,
      operations,
      positions,
      currencyPositions,
    });
  }
}

export default InvestmentServiceToken;

export { InvestmentServiceStub };
export type { InvestmentService };
