import {
  Currency,
  CurrencyPosition,
  Operation,
} from 'tinkoff-investment-js-client-api';
import {
  InstrumentPriceInfo,
  PositionWithCurrency,
  Totals,
} from '../../types/model';

const CURRENCY_FIGIS: { [currency in Currency]?: string } = {
  USD: 'BBG0013HGFT4',
  EUR: 'BBG0013HJJ31',
};

type CurrencyFigiInfo = {
  figi: string;
  currency: Currency;
};

export function getUniqueFigiInfoByCurrency(
  currencies: Currency[]
): CurrencyFigiInfo[] {
  const uniqueCurrencies = Array.from(new Set(currencies));
  return uniqueCurrencies
    .filter((currency) => CURRENCY_FIGIS[currency])
    .map((currency) => ({
      currency,
      figi: CURRENCY_FIGIS[currency] as string,
    }));
}

function getCurrencyPriceByInfo(
  currency: Currency,
  instrumentsPriceInfo: InstrumentPriceInfo[]
) {
  const [figiInfo] = getUniqueFigiInfoByCurrency([currency]);
  // lastPrice = 1 for RUB
  const { lastPrice: currencyPriceInRub = 1 } =
    instrumentsPriceInfo.find(({ figi }) => figi === figiInfo?.figi) || {};

  return currencyPriceInRub;
}

function getPortfolioCurrentCost({
  positions,
  currencyPositions,
  portfolioInstrumentsPriceInfo,
}: {
  positions: PositionWithCurrency[];
  currencyPositions: CurrencyPosition[];
  portfolioInstrumentsPriceInfo: InstrumentPriceInfo[];
}): number {
  const currencyCost: number = currencyPositions.reduce(
    (sumRub, { currency, balance }) =>
      sumRub +
      getCurrencyPriceByInfo(currency, portfolioInstrumentsPriceInfo) * balance,
    0
  );

  const instrumentsCost: number = positions.reduce(
    (sum, { figi, balance, currency }) => {
      const lastPriceOfInstrument =
        portfolioInstrumentsPriceInfo.find(
          (priceInfo) => priceInfo.figi === figi
        )?.lastPrice || 0;

      return (
        sum +
        balance *
          lastPriceOfInstrument *
          getCurrencyPriceByInfo(
            currency ?? 'RUB',
            portfolioInstrumentsPriceInfo
          )
      );
    },
    0
  );
  return currencyCost + instrumentsCost;
}

export function getPortfolioTotals({
  portfolioInstrumentsPriceInfo,
  operations,
  positions,
  currencyPositions,
}: {
  portfolioInstrumentsPriceInfo: InstrumentPriceInfo[];
  operations: Operation[];
  positions: PositionWithCurrency[];
  currencyPositions: CurrencyPosition[];
}): Totals {
  const currentPortfolioCost = getPortfolioCurrentCost({
    portfolioInstrumentsPriceInfo,
    currencyPositions,
    positions,
  });

  const portfolioPayInCost = operations.reduce(
    (total, { operationType, payment, currency }) => {
      switch (operationType) {
        case 'PayIn':
        case 'PayOut': {
          return (
            total +
            payment *
              getCurrencyPriceByInfo(currency, portfolioInstrumentsPriceInfo)
          );
        }
        default:
          return total;
      }
    },
    0
  );

  const profit = currentPortfolioCost - portfolioPayInCost;
  return {
    payIn: portfolioPayInCost,
    profit,
    profitPercent: (profit / portfolioPayInCost) * 100,
  };
}
