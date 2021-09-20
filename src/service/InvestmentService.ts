import {
  CurrencyPosition,
  Operation,
  PortfolioPosition,
  UserAccount,
} from 'tinkoff-investment-js-client-api';
import {
  InstrumentPriceInfo,
  PositionWithCurrency,
  Totals,
} from '../types/model';
import CustomApi from './CustomApi';
import {
  getAggregatedCurrencyPositions,
  getAggregatedInstrumentPositions,
} from './utils/aggregate-utils';
import {
  getPortfolioTotals,
  getUniqueFigiInfoByCurrency,
} from './utils/price-utils';

// type PositionsResponse = {
//   positions: PositionWithPrices[];
//   currencyPositions: CurrencyPosition[];
// };

// async function getPriceInformation({
//   api,
//   positions,
//   operations,
//   currencyPositions,
//   portfolioCurrencyPriceInfo,
// }: {
//   api: CustomApi;
//   positions: PositionWithCurrency[];
//   operations: Operation[];
//   currencyPositions: CurrencyPosition[];
//   portfolioCurrencyPriceInfo: InstrumentPriceInfo[];
// }): Promise<PositionsResponse> {
//   const positionsWithPrices = await Promise.all(
//     positions.map(async (position) => {
//       const { figi } = position;
//       const lastPriceOfInstrument = await getLastPrice(
//         api,
//         position,
//         portfolioCurrenciesInfo
//       );
//       return convertPositionWithPrice();
//     })
//   );
//   return { positions: positionsWithPrices, currencyPositions };
// }

// type OperationWithFigi = Operation & { figi: string };
//
// async function getHistoricPositionsInfo(
//   api: CustomApi,
//   historicOperations: OperationWithFigi[][],
//   currenciesInfo: CurrencyInfo[]
// ) {
//   let figis: string[] = [];
//   const currencies: { [figi: string]: Currency } = {};
//   const recordMap: PortfolioPositionMap = {};
//   historicOperations.forEach((operationsForAcc) => {
//     operationsForAcc.forEach((operation) => {
//       const { figi } = operation;
//       figis.push(figi);
//       currencies[figi] = operation.currency;
//     });
//   });
//
//   figis = Array.from(new Set(figis));
//   const instruments = (
//     await Promise.all(figis.map((figi) => api.searchOne({ figi })))
//   ).filter(Boolean) as MarketInstrument[];
//
//   instruments.forEach((instrument) => {
//     const { figi } = instrument;
//     const currency: Currency = currencies[figi];
//     recordMap[figi] = new Array(historicOperations.length).fill(
//       instrumentToEmptyPosition(instrument, currency)
//     );
//   });
//   return getPriceInformation(
//     api,
//     recordMap,
//     historicOperations,
//     currenciesInfo
//   );
// }

// async function getLastPrice(
//   api: CustomApi,
//   position: PortfolioPosition,
//   // this param is required because we load currency prices before this call
//   currencyPriceInfo: InstrumentPriceInfo[]
// ) {
//   const { instrumentType, figi } = position;
//   let lastPrice: number;
//   if (instrumentType === 'Currency') {
//     // lastPrice = 1 for RUB
//     ({ lastPrice = 1 } =
//       currencyPriceInfo.find(
//         ({ figi: currencyFigi }) => currencyFigi === figi
//       ) || {});
//   } else {
//     lastPrice = await api.getLastPrice(figi);
//   }
//   return lastPrice;
// }

class InvestmentService {
  private readonly api: CustomApi;

  constructor(secretToken: string, isProd = true) {
    this.api = new CustomApi({ isProd, secretToken });
  }

  async getOperations(): Promise<Operation[]> {
    return this.api.getOperations();
  }

  async getAccounts(): Promise<UserAccount[]> {
    return this.api.getAccounts();
  }

  private async getAccountIds(): Promise<string[]> {
    const accounts = await this.api.getAccounts();
    return accounts.map(({ brokerAccountId }) => brokerAccountId);
  }

  private async getPositionsWithOperations(accountIds: string[]): Promise<{
    positions: PositionWithCurrency[];
    currencyPositions: CurrencyPosition[];
    operations: Operation[];
  }> {
    const operations: Operation[] = [];
    const positions: PortfolioPosition[][] = [];
    const currencyPositions: CurrencyPosition[][] = [];
    for (let i = 0; i < accountIds.length; i += 1) {
      // loop through all accounts to get all positions and operations
      this.api.setCurrentAccountId(accountIds[i]);

      // eslint-disable-next-line no-await-in-loop
      const [
        currentAccPositions,
        currentAccOperations,
        currentAccCurrencies,
        // eslint-disable-next-line no-await-in-loop
      ] = await Promise.all([
        this.api.getPortfolio(),
        this.api.getOperations(),
        this.api.getPortfolioCurrencies(),
      ]);

      positions[i] = currentAccPositions.filter(
        ({ instrumentType }) => instrumentType !== 'Currency'
      );
      currencyPositions[i] = currentAccCurrencies;
      operations.push(...currentAccOperations);
    }
    return {
      operations,
      positions: getAggregatedInstrumentPositions(positions),
      currencyPositions: getAggregatedCurrencyPositions(currencyPositions),
    };
  }

  // async getHistoricPositions(
  //   brokerAccountId?: string
  // ): Promise<PositionMapWithPrices> {
  //   const accountIds = brokerAccountId
  //     ? [brokerAccountId]
  //     : await this.getAccountIds();
  //
  //   const [positionMap, operations] = await this.getPositionsWithOperations(
  //     accountIds
  //   );
  //   const historicOperations = operations.map((operationsForAcc) =>
  //     operationsForAcc.filter(({ figi }) => figi && !positionMap[figi])
  //   ) as OperationWithFigi[][];
  //   const currenciesInfo = await this.getCurrencyInfo(
  //     ([] as Operation[])
  //       .concat(...historicOperations)
  //       .map(({ currency }) => currency)
  //   );
  //   return getHistoricPositionsInfo(
  //     this.api,
  //     historicOperations,
  //     currenciesInfo
  //   );
  // }

  // private async getPositionsPriceInfomation({
  //   operations,
  //   positions,
  // }: {
  //   operations: Operation[];
  //   positions: PositionWithCurrency[];
  // }) {}
  //
  // // async getCurrentPositions(
  // //   brokerAccountId?: string
  // // ): Promise<PositionsResponse> {
  // //   const accountIds = brokerAccountId
  // //     ? [brokerAccountId]
  // //     : await this.getAccountIds();
  // //
  // //   const { positions, operations, currencyPositions } =
  // //     await this.getPositionsWithOperations(accountIds);
  // //   const portfolioCurrencyPriceInfo =
  // //     await this.getPortfolioInstrumentsPriceInfo(
  // //       operations,
  // //       currencyPositions
  // //     );
  // //
  // //   return getPriceInformation({
  // //     api: this.api,
  // //     positions,
  // //     operations,
  // //     currencyPositions,
  // //     portfolioCurrencyPriceInfo,
  // //   });
  // // }

  private async getPortfolioInstrumentsPriceInfo({
    operations,
    positions,
    currencyPositions,
  }: {
    operations: Operation[];
    positions: PositionWithCurrency[];
    currencyPositions: CurrencyPosition[];
  }): Promise<InstrumentPriceInfo[]> {
    const currencyFigis = getUniqueFigiInfoByCurrency(
      // currencies of portfolio operations / instruments + portfolio currency positions
      [
        ...operations.map(({ currency }) => currency),
        ...currencyPositions.map(({ currency }) => currency),
      ]
    ).map(({ figi }) => figi);
    const instrumentFigis = positions.map(({ figi }) => figi);
    const figis = [...currencyFigis, ...instrumentFigis];

    return Promise.all(
      figis.map(async (figi) => {
        const lastPrice = await this.api.getLastPrice(figi);
        return { figi, lastPrice };
      })
    );
  }

  async getTotal(brokerAccountId?: string): Promise<Totals> {
    const accountIds = brokerAccountId
      ? [brokerAccountId]
      : await this.getAccountIds();

    const { positions, operations, currencyPositions } =
      await this.getPositionsWithOperations(accountIds);

    const portfolioInstrumentsPriceInfo =
      await this.getPortfolioInstrumentsPriceInfo({
        operations,
        positions,
        currencyPositions,
      });

    return getPortfolioTotals({
      portfolioInstrumentsPriceInfo,
      operations,
      positions,
      currencyPositions,
    });
  }
}

export default InvestmentService;
