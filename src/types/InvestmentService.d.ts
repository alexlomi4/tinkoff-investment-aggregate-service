// eslint-disable-next-line max-classes-per-file
import OpenAPI, {
  Currency,
  Operation,
  PortfolioPosition,
  UserAccount,
} from 'tinkoff-investment-js-client-api';

export declare type CurrencyInfo = {
  lastPrice?: number;
  figi?: string;
  currency: Currency;
};

export declare type PositionWithPrices = PortfolioPosition & {
  lastPrice?: number;
  totalNet: number;
  buyCost: number;
  operationsTotal: number;
  instrumentQuantity: number;
  currency: Currency | undefined;
  netPercent: number;
};

declare type PositionMap<T extends PortfolioPosition> = {
  [figi: string]: T[];
};

export declare type PortfolioPositionMap = PositionMap<PortfolioPosition>;

export declare type PositionMapWithPrices = PositionMap<PositionWithPrices>;

export declare type Totals = {
  totalPayIn: number;
  netTotal: number;
  percent: number;
};

declare type OpenApiConfig = {
  apiURL: string;
  socketURL: string;
  secretToken: string;
  brokerAccountId?: string;
};

export class CustomApi extends OpenAPI {
  private readonly token: string;

  constructor(config: OpenApiConfig);

  getKeyForRequest(prefix: string): string;
}

export default class InvestmentService {
  static getAccounts(api: CustomApi): Promise<UserAccount[]>;

  static getAccountIds(api: CustomApi): Promise<string[]>;

  private static getOperations(
    api: CustomApi,
    from: string
  ): Promise<Operation[]>;

  private static getPositionsWithOperations(
    api: CustomApi,
    accountIds: string[]
  ): Promise<[PortfolioPositionMap, Operation[][]]>;

  static getHistoricPositions(api: CustomApi): Promise<PositionMapWithPrices>;

  static getHistoricPositionsByIds(
    api: CustomApi,
    accountIds: string[]
  ): Promise<PositionMapWithPrices>;

  static getCurrenciesInfo(
    api: CustomApi,
    currenciesList: Currency[]
  ): Promise<CurrencyInfo[]>;

  static getCurrentPositions(api: CustomApi): Promise<PositionMapWithPrices>;

  static getCurrentPositionsByIds(
    api: CustomApi,
    accountIds: string[]
  ): Promise<PositionMapWithPrices>;

  static getTotal(api: CustomApi): Promise<Totals>;

  static getTotalByIds(api: CustomApi, accountIds: string[]): Promise<Totals>;
}
