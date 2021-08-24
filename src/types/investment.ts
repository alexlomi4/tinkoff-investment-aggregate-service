import { Currency, PortfolioPosition } from 'tinkoff-investment-js-client-api';

export type CurrencyInfo = {
  lastPrice?: number;
  figi?: string;
  currency: Currency;
};

export type PositionWithPrices = PortfolioPosition & {
  lastPrice?: number;
  totalNet: number;
  buyCost: number;
  operationsTotal: number;
  instrumentQuantity: number;
  currency: Currency | undefined;
  netPercent: number;
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
