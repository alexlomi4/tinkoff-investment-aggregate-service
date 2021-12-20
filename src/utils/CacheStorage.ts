const MS_IN_SEC = 1e3;
const DEFAULT_TTL = MS_IN_SEC * 60;

const PROMISE_MAP: { [key: string]: Promise<any> } = {};

class CacheStorage {
  static withPromiseCache<T>(
    asyncFunc: () => Promise<T>,
    key: string,
    ttl: number = DEFAULT_TTL
  ): Promise<T> {
    let value = PROMISE_MAP[key];
    if (!value) {
      value = asyncFunc();
      PROMISE_MAP[key] = value;

      setTimeout(() => {
        delete PROMISE_MAP[key];
      }, ttl);
    }
    return value;
  }
}

export default CacheStorage;
