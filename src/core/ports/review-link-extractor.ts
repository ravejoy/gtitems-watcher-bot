import type { Site } from '../../domain/site.js';

export interface ReviewLinkExtractor {
  extract(page: number): Promise<Site[]>;
}
