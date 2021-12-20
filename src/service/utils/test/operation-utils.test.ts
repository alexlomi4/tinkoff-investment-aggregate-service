import {
  Currency,
  Operation,
  PortfolioPosition,
} from 'tinkoff-investment-js-client-api';
import { getNotSoldCurrencyQuantity } from '../operations-utils';
import firstAccOperations from '../../../stub-data/operations_1.json';
import secondAccOperations from '../../../stub-data/operations_2.json';
import firstAccPositions from '../../../stub-data/positions_1.json';
import secondAccPositions from '../../../stub-data/positions_2.json';
import priceInfo from '../../../stub-data/lastPrice.json';
import { getUniqueFigiInfoByCurrency } from '../currency-utils';
import { convertToAggregatedInstrumentPositions } from '../../../api/helpers';

const aggregatedOperations = [
  ...firstAccOperations,
  ...secondAccOperations,
] as Operation[];
const aggregatedPositions = convertToAggregatedInstrumentPositions(
  [firstAccPositions, secondAccPositions] as PortfolioPosition[][],
  priceInfo
);

describe('Get bought and not sold currency', () => {
  test('Get bought and not sold USD: 6655', () => {
    const [figiInfo] = getUniqueFigiInfoByCurrency(['USD']);
    expect(typeof figiInfo?.figi === 'string').toBeTruthy();

    expect(
      getNotSoldCurrencyQuantity(
        aggregatedPositions.find(({ figi }) => figi) as {
          currency: Currency;
          balance: number;
        },
        aggregatedOperations
      )
    ).toBeCloseTo(6655, 0);
  });

  test('Get bought and not sold EUR: 0.07', () => {
    const [figiInfo] = getUniqueFigiInfoByCurrency(['EUR']);
    expect(typeof figiInfo?.figi === 'string').toBeTruthy();

    expect(
      getNotSoldCurrencyQuantity(
        aggregatedPositions.find(({ figi }) => figi === figiInfo.figi) as {
          currency: Currency;
          balance: number;
        },
        aggregatedOperations
      )
    ).toBeCloseTo(0.07, 1);
  });
});
