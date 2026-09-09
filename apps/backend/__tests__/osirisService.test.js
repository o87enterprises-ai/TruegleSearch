/**
 * The normaliser, tested against every row shape a keyless geo feed plausibly
 * emits. These are the parts with real judgement in them; the HTTP layer above
 * is a thin wrapper that cannot run without a network.
 *
 * The point of the candidate-key design is to survive an upstream we could not
 * inspect. The point of these tests is that "survive" means read it correctly
 * or say so — never quietly return an empty map.
 */
const { _internals } = require('../services/OsirisService');
const { coordsOf, rowsOf, propsOf, inBbox, parseBbox } = _internals;

describe('coordsOf', () => {
  it('reads the common flat spellings', () => {
    expect(coordsOf({ lat: 51.5, lon: -0.12 })).toEqual([-0.12, 51.5]);
    expect(coordsOf({ latitude: 51.5, longitude: -0.12 })).toEqual([-0.12, 51.5]);
    expect(coordsOf({ lat: 51.5, lng: -0.12 })).toEqual([-0.12, 51.5]);
  });

  it('reads numbers that arrived as strings', () => {
    expect(coordsOf({ lat: '51.5', lon: '-0.12' })).toEqual([-0.12, 51.5]);
  });

  it('trusts a GeoJSON row\'s own geometry rather than re-deriving one', () => {
    expect(coordsOf({ geometry: { type: 'Point', coordinates: [-0.12, 51.5] } })).toEqual([-0.12, 51.5]);
  });

  it('reads a bare [lon, lat] pair', () => {
    expect(coordsOf({ coordinates: [-0.12, 51.5] })).toEqual([-0.12, 51.5]);
  });

  it('returns null for a row with no position — never null island', () => {
    // [0,0] is a real place in the Gulf of Guinea. A row plotted there is a
    // lie the map tells confidently, which is worse than an absent row.
    expect(coordsOf({ callsign: 'BAW123' })).toBeNull();
    expect(coordsOf({ lat: 51.5 })).toBeNull();
    expect(coordsOf(null)).toBeNull();
    expect(coordsOf('nonsense')).toBeNull();
  });

  it('rejects out-of-range values rather than plotting them', () => {
    // Matching an `x`/`y` that turned out to be pixels, not degrees.
    expect(coordsOf({ y: 4000, x: 900 })).toBeNull();
    expect(coordsOf({ lat: 91, lon: 0 })).toBeNull();
    expect(coordsOf({ lat: 0, lon: 181 })).toBeNull();
  });

  it('keeps a genuine zero, which is not the same as a missing value', () => {
    expect(coordsOf({ lat: 0, lon: 0 })).toEqual([0, 0]);
  });

  it('ignores non-numeric junk in a coordinate field', () => {
    expect(coordsOf({ lat: 'unknown', lon: '-0.12' })).toBeNull();
  });
});

describe('rowsOf', () => {
  it('takes a bare array as the rows', () => {
    expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it('finds the rows inside each envelope shape a feed might use', () => {
    for (const key of ['features', 'data', 'results', 'items', 'rows', 'states', 'list']) {
      expect(rowsOf({ [key]: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    }
  });

  it('reads the shapes the probe actually found on the live host', () => {
    // Measured, not imagined. Every OSIRIS feed wraps its rows in either a key
    // named after the layer or the generic `events`:
    //   earthquakes -> { earthquakes, total, timestamp }
    //   fires       -> { fires, total, source, timestamp }
    //   weather     -> { events, total, timestamp }
    //   conflict    -> { events, total, timestamp, source }
    expect(rowsOf({ earthquakes: [{ a: 1 }], total: 1, timestamp: 'x' }, 'earthquakes')).toEqual([{ a: 1 }]);
    expect(rowsOf({ fires: [{ a: 1 }], total: 1, source: 'FIRMS' }, 'fires')).toEqual([{ a: 1 }]);
    expect(rowsOf({ events: [{ a: 1 }], total: 1 }, 'weather')).toEqual([{ a: 1 }]);
    expect(rowsOf({ events: [{ a: 1 }], total: 1, source: 'gdelt' }, 'conflict')).toEqual([{ a: 1 }]);
  });

  it('prefers the layer-named key over a generic one when a feed has both', () => {
    // A feed carrying both `flights` and an unrelated `data` key must not have
    // the wrong array picked out of it by list order.
    expect(rowsOf({ flights: [{ right: 1 }], data: [{ wrong: 1 }] }, 'flights')).toEqual([{ right: 1 }]);
  });

  it('merges a COMPOSITE feed instead of silently taking one array', () => {
    // Measured: maritime returns { ships, ports, chokepoints, total_*,
    // timestamp }. Reading only `ships` would drop the ports and the
    // chokepoints without a word — and for maritime analysis the chokepoints
    // are the most interesting rows in the response.
    const rows = rowsOf({
      ships: [{ mmsi: '1' }],
      ports: [{ port: 'Rotterdam' }],
      chokepoints: [{ name: 'Bab-el-Mandeb' }],
      total_ships: 1,
      timestamp: 'x',
    }, 'maritime');
    expect(rows).toHaveLength(3);
    // …and each row remembers which array it came from, so a chokepoint stays
    // distinguishable from a container ship after the merge.
    expect(rows.map((r) => r._group)).toEqual(['ships', 'ports', 'chokepoints']);
    expect(rows[2].name).toBe('Bab-el-Mandeb');
  });

  it('reads a declared single key, as measured for cameras', () => {
    // cctv: { cameras, total, sources, regions, timestamp }
    expect(rowsOf({ cameras: [{ a: 1 }], total: 1, regions: ['eu'] }, 'cctv'))
      .toEqual([{ _group: 'cameras', a: 1 }]);
  });

  it('skips a declared key the feed did not send, rather than failing', () => {
    const rows = rowsOf({ ships: [{ mmsi: '1' }], timestamp: 'x' }, 'maritime');
    expect(rows).toHaveLength(1);
  });

  it('returns null — not [] — when it cannot find any rows', () => {
    // The distinction is the whole point: null means "this shape is
    // unreadable, report it", [] would mean "the feed is empty", and
    // conflating them is how a broken layer draws as a quiet blank map.
    expect(rowsOf({ error: 'nope' }, 'flights')).toBeNull();
    expect(rowsOf(null)).toBeNull();
    expect(rowsOf('a string')).toBeNull();
  });
});

describe('propsOf', () => {
  it('keeps the scalars and drops the coordinates', () => {
    const p = propsOf({ lat: 51.5, lon: -0.12, callsign: 'BAW123', alt: 11000 });
    expect(p).toEqual({ callsign: 'BAW123', alt: 11000 });
  });

  it('lifts a GeoJSON row\'s own properties, where everything real lives', () => {
    const p = propsOf({ geometry: {}, properties: { mag: 5.1, place: 'Off Honshu' } });
    expect(p.mag).toBe(5.1);
    expect(p.place).toBe('Off Honshu');
  });

  it('drops nested objects, where feeds hide megabytes', () => {
    const p = propsOf({ name: 'x', history: [1, 2, 3], meta: { a: 1 } });
    expect(p).toEqual({ name: 'x' });
  });

  it('bounds long strings so one pathological row cannot bloat the payload', () => {
    expect(propsOf({ title: 'x'.repeat(1000) }).title).toHaveLength(240);
  });

  it('drops nulls rather than shipping empty fields to every marker', () => {
    expect(propsOf({ a: 1, b: null, c: undefined })).toEqual({ a: 1 });
  });
});

describe('parseBbox', () => {
  it('parses a well-formed box', () => {
    expect(parseBbox('-1,50,1,52')).toEqual([-1, 50, 1, 52]);
  });

  it('rejects anything malformed instead of half-applying it', () => {
    // A partly-parsed box would filter the map by nonsense, which looks like
    // "the layer has no data here" rather than "your input was wrong".
    expect(parseBbox('1,2,3')).toBeNull();
    expect(parseBbox('a,b,c,d')).toBeNull();
    expect(parseBbox('')).toBeNull();
    expect(parseBbox(undefined)).toBeNull();
    expect(parseBbox('-1,52,1,50')).toBeNull();   // south above north
    expect(parseBbox('-1,-100,1,52')).toBeNull(); // off the planet
  });
});

describe('inBbox', () => {
  const box = [-1, 50, 1, 52];

  it('keeps everything when no box was given', () => {
    expect(inBbox([170, -80], null)).toBe(true);
  });

  it('includes inside and excludes outside', () => {
    expect(inBbox([0, 51], box)).toBe(true);
    expect(inBbox([5, 51], box)).toBe(false);
    expect(inBbox([0, 60], box)).toBe(false);
  });

  it('handles a box crossing the antimeridian, where west > east', () => {
    // Pan the map across the Pacific and this is the box you get. Treating it
    // as an ordinary range excludes everything, so the layer silently empties
    // exactly where the dateline is on screen.
    const pacific = [170, -10, -170, 10];
    expect(inBbox([175, 0], pacific)).toBe(true);
    expect(inBbox([-175, 0], pacific)).toBe(true);
    expect(inBbox([0, 0], pacific)).toBe(false);
  });
});
