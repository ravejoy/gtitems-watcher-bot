import got, { type OptionsOfTextResponseBody } from 'got';
import iconv from 'iconv-lite';

export class HttpClient {
  constructor(private readonly baseHeaders?: Record<string, string>) {}

  async getCp1251(url: string, opts?: OptionsOfTextResponseBody): Promise<string> {
    const res = await got(url, {
      responseType: 'buffer',
      timeout: { request: 10000 },
      retry: { limit: 2 },
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ru,en;q=0.9',
        ...(this.baseHeaders ?? {}),
      },
      decompress: true,
      ...opts,
    });
    return iconv.decode(res.rawBody, 'win1251');
  }
}
