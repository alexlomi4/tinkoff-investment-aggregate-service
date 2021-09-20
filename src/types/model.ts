import { Currency, PortfolioPosition } from 'tinkoff-investment-js-client-api';

export type InstrumentPriceInfo = {
  lastPrice?: number;
  figi: string;
};

export type PositionWithCurrency = PortfolioPosition & {
  currency?: Currency;
};

export type PositionWithPrices = PositionWithCurrency & {
  lastPrice?: number;
  totalProfit: number;
  profitPercent: number;
  buyAndTaxesLoss: number;
  operationsProfit: number;
  notSoldCurrencyQuantity: number;
  currency?: Currency;
};

type PositionMap<T extends PositionWithCurrency> = {
  [figi: string]: T[];
};

export type PortfolioPositionMap = PositionMap<PositionWithCurrency>;

export type Totals = {
  payIn: number;
  profit: number;
  profitPercent: number;
};
