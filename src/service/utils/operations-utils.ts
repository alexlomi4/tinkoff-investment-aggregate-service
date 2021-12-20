import { Currency, Operation } from 'tinkoff-investment-js-client-api';
import {
  getCurrencyPriceByInfo,
  getUniqueFigiInfoByCurrency,
} from './currency-utils';
import { InstrumentPriceInfo } from '../../types/model';

export function getNotSoldCurrencyQuantity(
  position: { currency: Currency; balance: number },
  operations: Operation[]
): number {
  const [figiInfo] = getUniqueFigiInfoByCurrency([position.currency]);

  // RUB currency
  if (!figiInfo) return position.balance;

  const operationsForPosition = operations.filter(
    ({ figi }) => figi === figiInfo.figi
  );
  return (
    position.balance +
    operationsForPosition.reduce((count, { operationType, quantity = 0 }) => {
      switch (operationType) {
        case 'Buy':
          return count + quantity;
        case 'Sell':
          return count - quantity;
        default:
          return count;
      }
    }, 0)
  );
}

export function getInstrumentOperationsTotals(
  positionFigi: string,
  operations: Operation[]
): {
  buyAndTaxesTotal: number;
  operationsTotal: number;
  averageBuyPrice: number;
} {
  const operationsForPosition = operations.filter(
    ({ figi }) => figi === positionFigi
  );
  const isLossOperation = ({ operationType }: Operation) =>
    !!operationType && ['Buy', 'TaxDividend'].includes(operationType);

  const { lossOperationsCount, operationsTotal, buyAndTaxesTotal } =
    operationsForPosition.reduce(
      (netInfo, operation) => {
        const { operationType, payment, commission = { value: 0 } } = operation;

        const commissionVal = commission.value;

        const fullPayment = payment + commissionVal;
        switch (operationType) {
          case 'Buy':
          case 'Sell':
          case 'Dividend':
          case 'TaxDividend': {
            return {
              operationsTotal: netInfo.operationsTotal + fullPayment,
              buyAndTaxesTotal:
                netInfo.buyAndTaxesTotal +
                (isLossOperation(operation) ? fullPayment : 0),
              lossOperationsCount:
                netInfo.lossOperationsCount +
                (isLossOperation(operation) ? 1 : 0),
            };
          }
          default:
            return netInfo;
        }
      },
      { buyAndTaxesTotal: 0, operationsTotal: 0, lossOperationsCount: 0 }
    );

  return {
    buyAndTaxesTotal,
    operationsTotal,
    averageBuyPrice: buyAndTaxesTotal / lossOperationsCount,
  };
}

export function getPortfolioPayInCost(
  operations: Operation[],
  instrumentsPriceInfo: InstrumentPriceInfo[]
): number {
  return operations.reduce((total, { operationType, payment, currency }) => {
    switch (operationType) {
      case 'PayIn':
      case 'PayOut': {
        return (
          total +
          payment * getCurrencyPriceByInfo(currency, instrumentsPriceInfo)
        );
      }
      default:
        return total;
    }
  }, 0);
}

function compareByDate(a: Operation, b: Operation) {
  return new Date(b.date).getTime() - Math.sign(new Date(a.date).getTime());
}

type LastBuyInfo = {
  loss: number;
  currentQuantity: number;
};

export function getLastBuyTotalPrice(
  figi: string,
  operations: Operation[]
): number {
  const lastPriceInfo = operations
    .filter(({ figi: operationFigi }) => operationFigi === figi)
    .sort(compareByDate)
    .reduce<LastBuyInfo>(
      (
        { currentQuantity, loss },
        { operationType, payment, commission = {}, quantity = 0 }
      ) => {
        const fullPayment = payment + (commission.value || 0);
        if (
          operationType &&
          ['Buy', 'Sell', 'Dividend', 'TaxDividend'].includes(operationType)
        ) {
          return {
            currentQuantity:
              currentQuantity + -Math.sign(fullPayment) * quantity,
            loss,
          };
        }
        return { currentQuantity, loss };
      },
      { currentQuantity: 0, loss: 0 }
    );

  return lastPriceInfo.currentQuantity;
}
