import { CurrencyPosition, Operation } from 'tinkoff-investment-js-client-api';
import {
  InstrumentPriceInfo,
  PortfolioPositionWithPrice,
  Totals,
} from '../../types/model';
import { getCurrencyPriceByInfo } from './currency-utils';
import { getPortfolioPayInCost } from './operations-utils';

function getPortfolioCurrentCost({
  positions,
  currencyPositions,
  instrumentsPriceInfo,
}: {
  positions: PortfolioPositionWithPrice[];
  currencyPositions: CurrencyPosition[];
  instrumentsPriceInfo: InstrumentPriceInfo[];
}): number {
  const currencyCost: number = currencyPositions.reduce(
    (sumRub, { currency, balance }) =>
      sumRub + getCurrencyPriceByInfo(currency, instrumentsPriceInfo) * balance,
    0
  );

  const instrumentsCost: number = positions
    .filter(({ instrumentType }) => instrumentType !== 'Currency')
    .reduce((sum, { figi, balance, currency }) => {
      const lastPriceOfInstrument =
        instrumentsPriceInfo.find((priceInfo) => priceInfo.figi === figi)
          ?.lastPrice || 0;

      return (
        sum +
        balance *
          lastPriceOfInstrument *
          getCurrencyPriceByInfo(currency ?? 'RUB', instrumentsPriceInfo)
      );
    }, 0);
  return currencyCost + instrumentsCost;
}

// eslint-disable-next-line import/prefer-default-export
export function getPortfolioTotals({
  instrumentsPriceInfo,
  operations,
  positions,
  currencyPositions,
}: {
  instrumentsPriceInfo: InstrumentPriceInfo[];
  operations: Operation[];
  positions: PortfolioPositionWithPrice[];
  currencyPositions: CurrencyPosition[];
}): Totals {
  const currentPortfolioCost = getPortfolioCurrentCost({
    instrumentsPriceInfo,
    currencyPositions,
    positions,
  });

  const portfolioPayInCost = getPortfolioPayInCost(
    operations,
    instrumentsPriceInfo
  );

  const profit = currentPortfolioCost - portfolioPayInCost;
  return {
    payIn: portfolioPayInCost,
    profit,
    profitPercent: (profit / portfolioPayInCost) * 100,
  };
}
