import {
  Currency,
  CurrencyPosition,
  Operation,
  PortfolioPosition,
} from 'tinkoff-investment-js-client-api';
import {
  InstrumentPriceInfo,
  PortfolioPositionWithPrice,
  PortfolioPositionWithTotalPrices,
} from '../types/model';
import { getInstrumentOperationsTotals } from '../service/utils/operations-utils';

function compareByCurrency(
  position1: { currency: Currency },
  position2: { currency: Currency }
) {
  return position1.currency.localeCompare(position2.currency);
}

export function convertToAggregatedCurrencyPositions(
  currencyPositions: CurrencyPosition[][]
): CurrencyPosition[] {
  const flatCurrencyPositions = ([] as CurrencyPosition[]).concat(
    ...currencyPositions
  );
  const uniqueCurrencies = Array.from(
    new Set(flatCurrencyPositions.map(({ currency }) => currency))
  );

  return uniqueCurrencies
    .map((currency) => {
      const sameCurrencyPositions = flatCurrencyPositions.filter(
        (position) => currency === position.currency
      );
      return {
        currency,
        balance: sameCurrencyPositions.reduce(
          (sum, { balance }) => sum + balance,
          0
        ),
        blocked: sameCurrencyPositions.reduce(
          (sum, { blocked }) => sum + (blocked || 0),
          0
        ),
      };
    })
    .sort(compareByCurrency);
}

function toPositionWithCurrency(
  position: PortfolioPosition
): PortfolioPositionWithPrice {
  const { averagePositionPrice, averagePositionPriceNoNkd, expectedYield } =
    position;
  const notEmptyPrice =
    averagePositionPrice ?? averagePositionPriceNoNkd ?? expectedYield;
  const result: PortfolioPositionWithPrice = { ...position };
  if (notEmptyPrice) {
    result.currency = notEmptyPrice?.currency;
  }
  return result;
}

function compareByName(
  position1: { name: string },
  position2: { name: string }
) {
  return position1.name.localeCompare(position2.name);
}

export function convertToAggregatedInstrumentPositions(
  instrumentPositions: PortfolioPosition[][],
  priceInfo: InstrumentPriceInfo[]
): PortfolioPositionWithPrice[] {
  const positionsWithCurrency: PortfolioPositionWithPrice[] = (
    [] as PortfolioPosition[]
  )
    .concat(...instrumentPositions)
    .map(toPositionWithCurrency);

  const uniqueFigis = Array.from(
    new Set(positionsWithCurrency.map(({ figi }) => figi))
  );
  return uniqueFigis
    .map((uniqueFigi) => {
      const sameFigiPositions = positionsWithCurrency.filter(
        ({ figi }) => figi === uniqueFigi
      );

      const { currency, figi, ticker, isin, instrumentType, name } =
        sameFigiPositions[0];

      const result = {
        currency,
        figi,
        ticker,
        isin,
        instrumentType,
        balance: sameFigiPositions.reduce(
          (sum, { balance }) => sum + balance,
          0
        ),
        blocked: sameFigiPositions.reduce(
          (sum, { blocked }) => sum + (blocked || 0),
          0
        ),
        lots: sameFigiPositions.reduce((sum, { lots }) => sum + lots, 0),
        name,
      };

      const { lastPrice } =
        priceInfo.find(({ figi: priceFigi }) => priceFigi === figi) || {};

      return {
        ...result,
        ...(lastPrice && { lastPrice }),
        ...(currency && {
          averagePositionPrice: {
            currency,
            value:
              sameFigiPositions.reduce(
                (sum, { averagePositionPrice, balance }) =>
                  sum + (averagePositionPrice?.value || 0) * balance,
                0
              ) / result.balance,
          },
          averagePositionPriceNoNkd: {
            currency,
            value:
              sameFigiPositions.reduce(
                (sum, { averagePositionPriceNoNkd, balance }) =>
                  sum + (averagePositionPriceNoNkd?.value || 0) * balance,
                0
              ) / result.balance,
          },
          expectedYield: {
            currency,
            value: sameFigiPositions.reduce(
              (sum, { expectedYield }) => sum + (expectedYield?.value || 0),
              0
            ),
          },
        }),
      };
    })
    .sort(compareByName);
}

export function convertToPositionWithTotalPrices(
  position: PortfolioPositionWithPrice,
  operations: Operation[]
): PortfolioPositionWithTotalPrices {
  const { buyAndTaxesTotal, operationsTotal } = getInstrumentOperationsTotals(
    position.figi,
    operations
  );

  const totalProfit =
    operationsTotal + (position.lastPrice || 0) * position.balance;

  return {
    ...position,
    buyAndTaxesTotal,
    operationsTotal,
    totalProfit,
  };
}
