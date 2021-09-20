import {
  Currency,
  CurrencyPosition,
  MarketInstrument,
  Operation,
  PortfolioPosition,
} from 'tinkoff-investment-js-client-api';
import { PortfolioPositionMap, PositionWithPrices } from '../types/model';

export function instrumentToEmptyPosition(
  { figi, ticker, isin, type, name }: MarketInstrument,
  operationCurrency: Currency
): PortfolioPosition {
  return {
    figi,
    ticker,
    isin,
    name,
    instrumentType: type,
    balance: 0,
    lots: 0,
    averagePositionPrice: {
      currency: operationCurrency,
      value: 0,
    },
  };
}

export function currencyPositionToPortfolioPosition(
  { currency, balance }: CurrencyPosition,
  figi: string | undefined,
  currencyPortfolioPosition: PortfolioPosition | undefined
): PortfolioPosition {
  const { averagePositionPrice, name = currency } =
    currencyPortfolioPosition || {};
  return {
    ...currencyPortfolioPosition,
    instrumentType: 'Currency',
    name,
    figi: figi || currency,
    balance,
    lots: balance,
    averagePositionPrice: averagePositionPrice || {
      value: balance > 0 ? 1 : 0,
      currency: 'RUB',
    },
  };
}

function getPositionQuantity(
  position: PortfolioPosition,
  operationsForPosition: Operation[]
): number {
  if (position.instrumentType !== 'Currency') {
    return position.balance;
  }
  return operationsForPosition.reduce<number>(
    (count, { operationType, quantity = 0 }) => {
      switch (operationType) {
        case 'Buy':
          return count + quantity;
        case 'Sell':
          return count - quantity;
        default:
          return count;
      }
    },
    0
  );
}

function getInstrumentOperationsCost(operationsForPosition: Operation[]): {
  buyCost: number;
  operationsTotal: number;
} {
  return operationsForPosition.reduce(
    (net, { operationType, payment, commission = {} }) => {
      const commissionVal = commission.value || 0;
      const fullPayment = payment + commissionVal;
      switch (operationType) {
        case 'Buy':
        case 'Sell':
        case 'Dividend':
        case 'TaxDividend':
          return {
            operationsTotal: net.operationsTotal + fullPayment,
            buyCost:
              net.buyCost +
              (['Buy', 'TaxDividend'].includes(operationType)
                ? fullPayment
                : 0),
          };
        default:
          return net;
      }
    },
    { buyCost: 0, operationsTotal: 0 }
  );
}

export function convertPositionsWithPrice(
  positions: PortfolioPosition[],
  operations: Operation[][],
  lastPrice: number | undefined
): PositionWithPrices[] {
  const buyTotalPrice = getBuyInitialTotalPrice(operations, positions[0].figi);

  const updatedPositions = positions.map((position, index) => {
    const operationsForPosition = operations[index].filter(
      ({ figi }) => figi === position.figi
    );
    const { operationsTotal, buyCost } = getInstrumentOperationsCost(
      operationsForPosition
    );
    const balancePotential = getPositionQuantity(
      position,
      operationsForPosition
    );

    const totalProfit = operationsTotal + (lastPrice || 0) * balancePotential;
    return {
      ...position,
      lastPrice,
      totalProfit,
      buyAndTaxesLoss: buyCost,
      operationsProfit: operationsTotal,
      balancePotential,
      currency:
        position.averagePositionPrice && position.averagePositionPrice.currency,
    };
  });

  return updatedPositions.map((position) => {
    const totalInstrumentNet = updatedPositions.reduce(
      (sum, { totalProfit }) => totalProfit + sum,
      0
    );
    const profitPercent = Math.abs(100 * (totalInstrumentNet / buyTotalPrice));
    return {
      ...position,
      profitPercent,
    };
  });
}

const CURRENCY_FIGIS: { [currency: string]: string } = {
  USD: 'BBG0013HGFT4',
  EUR: 'BBG0013HJJ31',
};

type CurrencyFigiInfo = {
  figi: string;
  currency: Currency;
};

export function getFigiByCurrencies(
  currencies: Currency[]
): CurrencyFigiInfo[] {
  const uniqueCurrencies = Array.from(new Set(currencies));
  return uniqueCurrencies
    .filter((currency) => CURRENCY_FIGIS[currency])
    .map((currency) => ({
      currency,
      figi: CURRENCY_FIGIS[currency],
    }));
}

export function prepareEmptyPositions(
  positionMap: PortfolioPositionMap,
  operations: Operation[][]
): PortfolioPositionMap {
  const result = { ...positionMap };
  // fill empty positions
  Object.keys(result).forEach((figi) => {
    for (let i = 0; i < operations.length; i += 1) {
      if (!result[figi][i]) {
        const position = result[figi].find(Boolean) as PortfolioPosition;
        const { ticker, isin, instrumentType, name, averagePositionPrice } =
          position;
        result[figi][i] = {
          instrumentType,
          ticker,
          isin,
          name,
          figi,
          balance: 0,
          lots: 0,
        };
        if (averagePositionPrice) {
          result[figi][i].averagePositionPrice = {
            ...averagePositionPrice,
            value: 0,
          };
        }
      }
    }
  });
  return result;
}

function compareByDate(a: Operation, b: Operation) {
  return Math.sign(new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getBuyInitialTotalPrice(
  operations: Operation[][],
  figi: string
): number {
  const sortedOperations = operations
    .reduce(
      (posOperations, operationsForAcc) =>
        posOperations.concat(
          operationsForAcc.filter(({ figi: operFigi }) => operFigi === figi)
        ),
      []
    )
    .sort(compareByDate);
  return sortedOperations.reduce(
    (pricesInfo, { operationType, payment, commission = {}, quantity = 0 }) => {
      const fullPayment = payment + (commission.value || 0);
      const { priceAcc } = pricesInfo;
      if (operationType === 'Buy') {
        // eslint-disable-next-line no-param-reassign
        pricesInfo.count += quantity;
        if (pricesInfo.count > priceAcc.quantity) {
          // eslint-disable-next-line no-param-reassign
          pricesInfo.priceAcc = {
            total: priceAcc.total + fullPayment,
            quantity: priceAcc.quantity + quantity,
          };
        }
      } else if (operationType === 'Sell') {
        // eslint-disable-next-line no-param-reassign
        pricesInfo.count -= quantity;
      }
      return pricesInfo;
    },
    { priceAcc: { total: 0, quantity: 0 }, count: 0 }
  ).priceAcc.total;
}
