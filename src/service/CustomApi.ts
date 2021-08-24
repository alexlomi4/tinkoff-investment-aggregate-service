import OpenAPI from 'tinkoff-investment-js-client-api';

type OpenApiConfig = {
  apiURL: string;
  socketURL: string;
  secretToken: string;
  brokerAccountId?: string;
};

class CustomApi extends OpenAPI {
  token: string;

  constructor(config: OpenApiConfig) {
    const { secretToken } = config;
    super(config);
    this.token = secretToken;
  }

  getKeyForRequest(prefix: string): string {
    return `${prefix}_${this.token}`;
  }
}

export default CustomApi;
