import got, { type OptionsOfTextResponseBody } from 'got';
import iconv from 'iconv-lite';

export type HttpClientOptions = {
  requestTimeoutMs?: number;
  retryLimit?: number;
};

export class HttpClient {
  constructor(
    private readonly baseHeaders?: Record<string, string>,
    private readonly options: HttpClientOptions = {},
  ) {}

  async getCp1251(url: string, opts?: OptionsOfTextResponseBody): Promise<string> {
    const timeoutMs = this.options.requestTimeoutMs ?? 25_000; // was 10_000
    const retryLimit = this.options.retryLimit ?? 4; // was 2

    const res = await got(url, {
      responseType: 'buffer',
      timeout: { request: timeoutMs },
      retry: {
        limit: retryLimit,
        methods: ['GET'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
        errorCodes: [
          'ETIMEDOUT',
          'ECONNRESET',
          'EADDRINUSE',
          'ECONNREFUSED',
          'EPIPE',
          'ENOTFOUND',
          'ENETUNREACH',
          'EAI_AGAIN',
        ],
        // exponential backoff with cap
        calculateDelay: ({ attemptCount }) => Math.min(2000 * attemptCount, 8000),
      },
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ru,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        ...(this.baseHeaders ?? {}),
      },
      decompress: true,
      ...opts,
    });

    return iconv.decode(res.rawBody, 'win1251');
  }
}
