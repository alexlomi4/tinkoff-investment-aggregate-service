import { Currency, PortfolioPosition } from 'tinkoff-investment-js-client-api';

export type CurrencyInfo = {
  lastPrice?: number;
  figi: string;
  currency: Currency;
};

export type PositionWithPrices = PortfolioPosition & {
  lastPrice?: number;
  totalProfit: number;
  profitPercent: number;
  buyAndTaxesLoss: number;
  operationsProfit: number;
  /** *
   * bought amount and not sold yet (for currency)
   * for stocks, etfs and bonds equal to balance
   */
  balancePotential: number;
  currency?: Currency;
};

type PositionMap<T extends PortfolioPosition> = {
  [figi: string]: T[];
};

export type PortfolioPositionMap = PositionMap<PortfolioPosition>;

export type PositionMapWithPrices = PositionMap<PositionWithPrices>;

export type Totals = {
  totalPayIn: number;
  netTotal: number;
  percent: number;
};
