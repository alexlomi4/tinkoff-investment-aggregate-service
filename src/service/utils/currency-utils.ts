import { Currency } from 'tinkoff-investment-js-client-api';
import { InstrumentPriceInfo } from '../../types/model';

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

export function getCurrencyPriceByInfo(
  currency: Currency,
  instrumentsPriceInfo: InstrumentPriceInfo[]
): number {
  const [figiInfo] = getUniqueFigiInfoByCurrency([currency]);
  // lastPrice = 1 for RUB
  const { lastPrice: currencyPriceInRub = 1 } =
    instrumentsPriceInfo.find(({ figi }) => figi === figiInfo?.figi) || {};

  return currencyPriceInRub;
}
