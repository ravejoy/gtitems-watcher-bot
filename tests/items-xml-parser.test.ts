import { describe, it, expect } from 'vitest';
import { XmlFragmentParser } from '../src/infra/xml-fragment-item-parser.js';

const SAMPLE_XML = `<?xml version='1.0' encoding='windows-1251'?>
<item>
  <error> </error>
  <freeze_time>0</freeze_time>
  <items>
    <id>gtitem_9600123</id>
    <action></action>
    <alt>Book's page</alt>
    <img>/items/1119.jpg</img>
    <itemid>9600123</itemid>
    <itemv>1119</itemv>
    <link>&lt;a href='/cgi-bin/m.cgi?a=tool_jobs&amp;id=9600123&amp;site=26742&amp;version=v5.2' title='Work on the spawner'&gt;</link>
  </items>
  <items>
    <id>gtitem_9600124</id>
    <action></action>
    <alt>Bottle of beer</alt>
    <img>/items/1119.jpg</img>
    <itemid>9600124</itemid>
    <itemv>1119</itemv>
    <link>&lt;a href='/cgi-bin/m.cgi?a=tool_jobs&amp;id=9600124&amp;site=26742&amp;version=v5.2' title='Work on the spawner'&gt;</link>
  </items>
  <items>
    <id>gtitem_9600125</id>
    <action></action>
    <alt>Darth Vader</alt>
    <img>/items/1119.jpg</img>
    <itemid>9600125</itemid>
    <itemv>1119</itemv>
    <link>&lt;a href='/cgi-bin/m.cgi?a=tool_jobs&amp;id=9600125&amp;site=26742&amp;version=v5.2' title='Work on the spawner'&gt;</link>
  </items>
</item>`;

describe('XmlFragmentParser', () => {
  it('parses item names from <items><alt>…</alt>', () => {
    const parser = new XmlFragmentParser();
    const out = parser.parse(SAMPLE_XML, '26742');

    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ id: '26742-1', name: "Book's page" });
    expect(out[1]).toEqual({ id: '26742-2', name: 'Bottle of beer' });
    expect(out[2]).toEqual({ id: '26742-3', name: 'Darth Vader' });
  });

  it('returns [] on empty fragment', () => {
    const parser = new XmlFragmentParser();
    expect(parser.parse('', 'X')).toEqual([]);
  });
});
