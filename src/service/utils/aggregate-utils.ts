import {
  CurrencyPosition,
  PortfolioPosition,
} from 'tinkoff-investment-js-client-api';
import { PositionWithCurrency } from '../../types/model';

export function getAggregatedCurrencyPositions(
  currencyPositions: CurrencyPosition[][]
): CurrencyPosition[] {
  const flatCurrencyPoisitions = ([] as CurrencyPosition[]).concat(
    ...currencyPositions
  );
  const uniqueCurrencies = Array.from(
    new Set(flatCurrencyPoisitions.map(({ currency }) => currency))
  );

  return uniqueCurrencies.map((currency) => {
    const sameCurrencyPositions = flatCurrencyPoisitions.filter(
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
  });
}

function toPositionWithCurrency(
  position: PortfolioPosition
): PositionWithCurrency {
  const { averagePositionPrice, averagePositionPriceNoNkd, expectedYield } =
    position;
  const notEmptyPrice =
    averagePositionPrice ?? averagePositionPriceNoNkd ?? expectedYield;
  const result: PositionWithCurrency = { ...position };
  if (notEmptyPrice) {
    result.currency = notEmptyPrice?.currency;
  }
  return result;
}

export function getAggregatedInstrumentPositions(
  instrumentPositions: PortfolioPosition[][]
): PositionWithCurrency[] {
  const flatPositionsWithCurrency: PositionWithCurrency[] = (
    [] as PortfolioPosition[]
  )
    .concat(...instrumentPositions)
    .map(toPositionWithCurrency);

  // do not remove not aggregated fields such as averagePositionPrice
  if (instrumentPositions.length === 1) {
    return flatPositionsWithCurrency;
  }

  const uniqueFigis = Array.from(
    new Set(flatPositionsWithCurrency.map(({ figi }) => figi))
  );
  return uniqueFigis.map((uniqueFigi) => {
    const sameFigiPositions = flatPositionsWithCurrency.filter(
      ({ figi }) => figi === uniqueFigi
    );

    const { currency, figi, ticker, isin, instrumentType, name } =
      sameFigiPositions[0];

    // remove aggregated fields such as averagePositionPrice
    return {
      currency,
      figi,
      ticker,
      isin,
      instrumentType,
      balance: sameFigiPositions.reduce((sum, { balance }) => sum + balance, 0),
      blocked: sameFigiPositions.reduce(
        (sum, { blocked }) => sum + (blocked || 0),
        0
      ),
      lots: sameFigiPositions.reduce((sum, { lots }) => sum + lots, 0),
      name,
    };
  });
}
