export interface ItemSource {
  list(siteId: string): Promise<string>; // returns raw fragment (XML/HTML)
}
