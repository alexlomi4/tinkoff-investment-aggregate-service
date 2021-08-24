import {
  Currencies,
  Currency,
  MarketInstrument,
  Operation,
  Portfolio,
  PortfolioPosition,
  UserAccount,
  UserAccounts,
} from 'tinkoff-investment-js-client-api';
import {
  CurrencyInfo,
  PortfolioPositionMap,
  PositionMapWithPrices,
  Totals,
} from '../types/investment';
import {
  convertPositionsWithPrice,
  currencyPositionToPortfolioPosition,
  getFigiByCurrencies,
  instrumentToEmptyPosition,
  prepareEmptyPositions,
} from './utils';
import CashHelper from '../utils/CacheHelper';
import CustomApi from './CustomApi';

async function getPriceInformation(
  api: CustomApi,
  positionsMap: PortfolioPositionMap,
  operations: Operation[][],
  currenciesInfo: CurrencyInfo[]
): Promise<PositionMapWithPrices> {
  const figiPositions = await Promise.all(
    Object.keys(positionsMap).map(async (figi) => {
      // the same for any account
      const firstPosition = positionsMap[figi][0];
      const lastPrice = await getLastPrice(api, firstPosition, currenciesInfo);
      return {
        [figi]: convertPositionsWithPrice(
          positionsMap[figi],
          operations,
          lastPrice
        ),
      };
    })
  );

  return figiPositions.reduce(
    (obj, position) => ({
      ...obj,
      ...position,
    }),
    {}
  ) as PositionMapWithPrices;
}

type OperationWithFigi = Operation & { figi: string };

async function getHistoricPositionsInfo(
  api: CustomApi,
  positionMap: PortfolioPositionMap,
  historicOperations: OperationWithFigi[][],
  currenciesInfo: CurrencyInfo[]
) {
  let figis: string[] = [];
  const currencies: { [figi: string]: Currency } = {};
  const recordMap: PortfolioPositionMap = {};
  historicOperations.forEach((operationsForAcc) => {
    operationsForAcc.forEach((operation) => {
      const { figi } = operation;
      figis.push(figi);
      currencies[figi] = operation.currency;
    });
  });

  figis = Array.from(new Set(figis));
  const instruments = (
    await Promise.all(figis.map((figi) => api.searchOne({ figi })))
  ).filter(Boolean) as MarketInstrument[];

  instruments.forEach((instrument) => {
    const { figi } = instrument;
    const currency: Currency = currencies[figi];
    recordMap[figi] = new Array(historicOperations.length).fill(
      instrumentToEmptyPosition(instrument, currency)
    );
  });
  return getPriceInformation(
    api,
    recordMap,
    historicOperations,
    currenciesInfo
  );
}

async function getLastPrice(
  api: CustomApi,
  position: PortfolioPosition,
  currenciesInfo: CurrencyInfo[] | undefined = []
) {
  const { instrumentType, figi } = position;
  let lastPrice: number;
  if (instrumentType === 'Currency') {
    // 1: RUB
    ({ lastPrice = 1 } =
      currenciesInfo.find(({ figi: currencyFigi }) => currencyFigi === figi) ||
      {});
  } else {
    lastPrice = await CashHelper.withPromiseCache<number>(
      async () => {
        const { lastPrice: lastInstrumentPrice = 0 } = await api.orderbookGet({
          figi,
        });
        return lastInstrumentPrice;
      },
      api.getKeyForRequest(`lastPrice_${figi}`),
      3
    );
  }
  return lastPrice;
}

async function getPortfolioNet(
  api: CustomApi,
  portfolio: PortfolioPositionMap,
  currenciesInfo: CurrencyInfo[]
): Promise<number> {
  const instrumentNets: number[] = await Promise.all(
    Object.keys(portfolio).map(async (figi) => {
      const position = portfolio[figi][0];
      const lastPriceOfInstrument = await getLastPrice(
        api,
        position,
        currenciesInfo
      );
      return portfolio[figi].reduce(
        (net, { balance, averagePositionPrice = {} }) => {
          const currencyInfo = currenciesInfo.find(
            ({ currency }) => currency === averagePositionPrice.currency
          );
          // 1: RUB currency
          const { lastPrice: currencyPrice = 1 } = currencyInfo || {};
          return net + balance * lastPriceOfInstrument * currencyPrice;
        },
        0
      );
    })
  );
  return instrumentNets.reduce((sum, val) => sum + val, 0);
}

class InvestmentService {
  static async getAccounts(api: CustomApi): Promise<UserAccount[]> {
    const { accounts } = await CashHelper.withPromiseCache<UserAccounts>(
      () => api.accounts(),
      api.getKeyForRequest('accounts')
    );
    return accounts;
  }

  static async getAccountIds(api: CustomApi): Promise<string[]> {
    const accounts = await this.getAccounts(api);
    return accounts.map(({ brokerAccountId }) => brokerAccountId);
  }

  static async getOperations(
    api: CustomApi,
    from: string = new Date('1970-01-01').toISOString()
  ): Promise<Operation[]> {
    const { operations } = await api.operations({
      from,
      to: new Date().toISOString(),
    });
    return operations.filter(
      ({ status, operationType }) =>
        status !== 'Decline' && operationType !== 'BrokerCommission'
    );
  }

  static async getPositionsWithOperations(
    api: CustomApi,
    accountIds: string[]
  ): Promise<[PortfolioPositionMap, Operation[][]]> {
    const operations: Operation[][] = [];
    let positionMap: PortfolioPositionMap = {};
    for (let i = 0; i < accountIds.length; i += 1) {
      // loop through all accounts to get all positions and operations
      api.setCurrentAccountId(accountIds[i]);
      // eslint-disable-next-line no-await-in-loop
      const [
        { positions: currentAccPositions },
        currentAccOperations,
        { currencies: currentCurrencies },
        // eslint-disable-next-line no-await-in-loop
      ] = await CashHelper.withPromiseCache<
        [Portfolio, Operation[], Currencies]
      >(
        () =>
          Promise.all([
            api.portfolio(),
            this.getOperations(api),
            api.portfolioCurrencies(),
          ]),
        api.getKeyForRequest(`positionsAndOperations_${accountIds[i]}`)
      );

      positionMap = currentAccPositions
        .filter(({ instrumentType }) => instrumentType !== 'Currency')
        .reduce((positionMapAcc: PortfolioPositionMap, { figi, ...rest }) => {
          const positions =
            positionMapAcc[figi] || Array(operations.length).fill(undefined);
          positions[i] = { figi, ...rest };
          return {
            ...positionMapAcc,
            [figi]: positions,
          };
        }, positionMap);
      const currencyFigis = getFigiByCurrencies(
        currentCurrencies.map(({ currency }) => currency)
      );
      positionMap = currentCurrencies.reduce(
        (positionMapAcc: PortfolioPositionMap, { currency, balance }) => {
          const { figi } =
            currencyFigis.find(
              ({ currency: currencyByFigi }) => currency === currencyByFigi
            ) || {};
          const currencyPosition = currentAccPositions.find(
            ({ figi: positionFigi }) => positionFigi === figi
          );
          const key = figi || currency;
          return {
            ...positionMapAcc,
            [key]: [
              ...(positionMapAcc[key] || []),
              currencyPositionToPortfolioPosition(
                { currency, balance },
                figi,
                currencyPosition
              ),
            ],
          };
        },
        positionMap
      );
      operations.push(currentAccOperations);
    }
    return [prepareEmptyPositions(positionMap, operations), operations];
  }

  static async getHistoricPositions(
    api: CustomApi
  ): Promise<PositionMapWithPrices> {
    const accountIds = await this.getAccountIds(api);
    return this.getHistoricPositionsByIds(api, accountIds);
  }

  static async getHistoricPositionsByIds(
    api: CustomApi,
    accountIds: string[]
  ): Promise<PositionMapWithPrices> {
    const [positionMap, operations] =
      await InvestmentService.getPositionsWithOperations(api, accountIds);
    const historicOperations = operations.map((operationsForAcc) =>
      operationsForAcc.filter(({ figi }) => figi && !positionMap[figi])
    ) as OperationWithFigi[][];
    const currenciesInfo = await this.getCurrenciesInfo(
      api,
      ([] as Operation[])
        .concat(...historicOperations)
        .map(({ currency }) => currency)
    );
    return getHistoricPositionsInfo(
      api,
      positionMap,
      historicOperations,
      currenciesInfo
    );
  }

  static async getCurrenciesInfo(
    api: CustomApi,
    currenciesList: Currency[]
  ): Promise<CurrencyInfo[]> {
    if (!Array.isArray(currenciesList) || !currenciesList.length) {
      return [];
    }
    const currenciesWithFigi = getFigiByCurrencies(currenciesList);
    return Promise.all(
      currenciesWithFigi.map(async ({ figi, currency }) =>
        // TODO check if it should be another value
        CashHelper.withPromiseCache<CurrencyInfo>(
          async () => {
            const { lastPrice } = await api.orderbookGet({
              figi,
            });
            return { figi, currency, lastPrice };
          },
          api.getKeyForRequest(`currency_${figi}`),
          3
        )
      )
    );
  }

  static async getCurrentPositions(
    api: CustomApi
  ): Promise<PositionMapWithPrices> {
    const accountIds = await this.getAccountIds(api);
    return this.getCurrentPositionsByIds(api, accountIds);
  }

  static async getCurrentPositionsByIds(
    api: CustomApi,
    accountIds: string[]
  ): Promise<PositionMapWithPrices> {
    const [positionsMap, operations] =
      await InvestmentService.getPositionsWithOperations(api, accountIds);

    const currenciesInfo = await this.getCurrenciesInfo(
      api,
      ([] as Operation[]).concat(...operations).map(({ currency }) => currency)
    );
    return getPriceInformation(api, positionsMap, operations, currenciesInfo);
  }

  static async getTotal(api: CustomApi): Promise<Totals> {
    const accountIds = await this.getAccountIds(api);
    return this.getTotalByIds(api, accountIds);
  }

  static async getTotalByIds(
    api: CustomApi,
    accountIds: string[]
  ): Promise<Totals> {
    const [positionMap, operations] = await this.getPositionsWithOperations(
      api,
      accountIds
    );
    const flatOperations: Operation[] = ([] as Operation[]).concat(
      ...operations
    );
    const currenciesInfo = await this.getCurrenciesInfo(
      api,
      Array.from(new Set(flatOperations.map(({ currency }) => currency)))
    );
    const instrumentsNet = await getPortfolioNet(
      api,
      positionMap,
      currenciesInfo
    );

    const totalOperationCost = flatOperations.reduce(
      (total, { operationType, payment }) => {
        switch (operationType) {
          case 'PayIn':
          case 'PayOut':
            return total + payment;
          default:
            return total;
        }
      },
      0
    );

    const netTotal = instrumentsNet - totalOperationCost;

    return {
      totalPayIn: totalOperationCost,
      netTotal: instrumentsNet - totalOperationCost,
      percent: (netTotal / totalOperationCost) * 100,
    };
  }
}

export default InvestmentService;
