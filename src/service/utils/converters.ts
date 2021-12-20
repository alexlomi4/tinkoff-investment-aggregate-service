import {
  CurrencyPosition,
  MarketInstrument,
  Operation,
} from 'tinkoff-investment-js-client-api';
import {
  CurrencyPositionWithPrices,
  InstrumentPriceInfo,
  PositionPrices,
  PortfolioPositionWithPrice,
  PortfolioPositionWithTotalPrices,
} from '../../types/model';
import {
  getInstrumentOperationsTotals,
  getNotSoldCurrencyQuantity,
} from './operations-utils';
import {
  getCurrencyPriceByInfo,
  getUniqueFigiInfoByCurrency,
} from './currency-utils';

export function instrumentToEmptyPosition(
  { figi, ticker, isin, type, name, currency }: MarketInstrument,
  operations: Operation[]
): PortfolioPositionWithTotalPrices {
  const operationsForPosition = operations.filter(
    (operation) => operation.figi === figi
  );
  const operationCurrency = operationsForPosition.find(
    (operation) => figi === operation.figi && operation.currency
  )?.currency;

  const { buyAndTaxesTotal, operationsTotal } = getInstrumentOperationsTotals(
    figi,
    operationsForPosition
  );

  return {
    figi,
    ticker,
    isin,
    name,
    instrumentType: type,
    balance: 0,
    lots: 0,
    currency: operationCurrency || currency,
    operationsTotal,
    buyAndTaxesTotal,
    totalProfit: operationsTotal,
  };
}

/*
export function prepareEmptyPositions(
  positionMap: PortfolioPositionMap,
  operations: Operation[][]
): PortfolioPositionMap {
  const result = { ...positionMap };
  // fill empty positions
  Object.keys(result).forEach((figi) => {
    for (let i = 0; i < operations.length; i += 1) {
      if (!result[figi][i]) {
        const position = result[figi].find(Boolean) as PortfolioPosition;
        const { ticker, isin, instrumentType, name, averagePositionPrice } =
          position;
        result[figi][i] = {
          instrumentType,
          ticker,
          isin,
          name,
          figi,
          balance: 0,
          lots: 0,
        };
        if (averagePositionPrice) {
          result[figi][i].averagePositionPrice = {
            ...averagePositionPrice,
            value: 0,
          };
        }
      }
    }
  });
  return result;
}
*/

export function convertToPositionPriceInfo({
  positions,
  operations,
  instrumentsPriceInfo,
}: {
  positions: PortfolioPositionWithPrice[];
  operations: Operation[];
  instrumentsPriceInfo: InstrumentPriceInfo[];
}): PositionPrices[] {
  return positions.map((position) => {
    const { figi } = position;

    const { lastPrice = 0 } =
      instrumentsPriceInfo.find(({ figi: infoFigi }) => infoFigi === figi) ||
      {};

    const { buyAndTaxesTotal, operationsTotal } = getInstrumentOperationsTotals(
      position.figi,
      operations
    );

    const totalProfit = operationsTotal + lastPrice * position.balance;
    const profitPercent = Math.abs(100 * (totalProfit / buyAndTaxesTotal));

    return {
      lol: '3',
      lastPrice,
      totalProfit,
      buyAndTaxesTotal,
      operationsTotal,
      profitPercent,
    };
  });
}

export function convertToCurrencyPositionsWithPrice({
  currencyPositions,
  operations,
  instrumentsPriceInfo,
}: {
  currencyPositions: CurrencyPosition[];
  operations: Operation[];
  instrumentsPriceInfo: InstrumentPriceInfo[];
}): CurrencyPositionWithPrices[] {
  return currencyPositions.map((position) => {
    const { currency } = position;

    const lastPrice = getCurrencyPriceByInfo(currency, instrumentsPriceInfo);

    const [figInInfo] = getUniqueFigiInfoByCurrency([currency]);
    const { buyAndTaxesTotal, operationsTotal } = getInstrumentOperationsTotals(
      figInInfo?.figi ?? '',
      operations
    );

    const notSoldQuantity = getNotSoldCurrencyQuantity(position, operations);

    const totalProfit = operationsTotal + lastPrice * notSoldQuantity;
    const profitPercent =
      Math.sin(totalProfit) * Math.abs(100 * (totalProfit / buyAndTaxesTotal));

    return {
      ...position,
      lastPrice,
      totalProfit,
      profitPercent,
      buyAndTaxesTotal,
      operationsTotal,
    };
  });
}
