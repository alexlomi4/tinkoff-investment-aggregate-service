const MS_IN_SEC = 1e3;
const SECONDS_IN_MINUTE = 60;
const DEFAULT_TTL_MS = MS_IN_SEC * SECONDS_IN_MINUTE;

const PROMISE_MAP: { [key: string]: Promise<any> } = {};

class CacheHelper {
  static withPromiseCache<T>(
    asyncFunc: () => Promise<T>,
    key: string,
    ttlSec?: number
  ): Promise<T> {
    let value = PROMISE_MAP[key];
    if (!value) {
      value = asyncFunc();
      PROMISE_MAP[key] = value;

      const ttlMS = ttlSec ? ttlSec * MS_IN_SEC : DEFAULT_TTL_MS;
      setTimeout(() => {
        delete PROMISE_MAP[key];
      }, ttlMS);
    }
    return value;
  }
}

export default CacheHelper;
