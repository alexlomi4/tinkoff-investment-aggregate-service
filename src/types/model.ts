import {
  Currency,
  CurrencyPosition,
  PortfolioPosition,
} from 'tinkoff-investment-js-client-api';

export type PortfolioPositionWithPrice = PortfolioPosition & {
  lastPrice?: number;
  currency?: Currency;
};

export type InstrumentPriceInfo = {
  lastPrice?: number;
  figi: string;
};

export type PositionPrices = {
  totalProfit: number;
  buyAndTaxesTotal: number;
  operationsTotal: number;
};

export type PortfolioPositionWithTotalPrices = PortfolioPositionWithPrice &
  PositionPrices;

export type CurrencyPositionWithPrices = CurrencyPosition & PositionPrices;

export type Totals = {
  payIn: number;
  profit: number;
  profitPercent: number;
};
