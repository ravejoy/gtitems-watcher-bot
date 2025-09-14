import type { Site } from './site.js';

export interface PageScanner {
  scanPage(page: number): Promise<Site[]>;
  scanSiteReviews(site: Site): Promise<Site>;
}
