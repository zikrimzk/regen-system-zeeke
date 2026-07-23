const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const HIPO_URL = 'http://universities.hipolabs.com/search';
const WIKIDATA_URL = 'https://query.wikidata.org/sparql';
const WIKIDATA_COUNTRIES = {
  Malaysia: 'Q833',
  Singapore: 'Q334',
  Indonesia: 'Q252',
  Thailand: 'Q869',
  Brunei: 'Q921',
  Philippines: 'Q928',
  'United Kingdom': 'Q145',
  'United States': 'Q30',
  Australia: 'Q408',
  'New Zealand': 'Q664',
  Canada: 'Q16',
  India: 'Q668',
  China: 'Q148',
  Japan: 'Q17',
  'South Korea': 'Q884',
  Germany: 'Q183',
  France: 'Q142',
};

const MALAYSIA_PLACES = [
  ['Kangar', 'Perlis'], ['Kuala Perlis', 'Perlis'], ['Alor Setar', 'Kedah'],
  ['Sungai Petani', 'Kedah'], ['Kulim', 'Kedah'], ['Langkawi', 'Kedah'],
  ['George Town', 'Pulau Pinang'], ['Bayan Lepas', 'Pulau Pinang'], ['Butterworth', 'Pulau Pinang'],
  ['Kota Bharu', 'Kelantan'], ['Pasir Mas', 'Kelantan'], ['Kuala Terengganu', 'Terengganu'],
  ['Kuantan', 'Pahang'], ['Temerloh', 'Pahang'], ['Bentong', 'Pahang'],
  ['Ipoh', 'Perak'], ['Taiping', 'Perak'], ['Seri Iskandar', 'Perak'],
  ['Shah Alam', 'Selangor'], ['Petaling Jaya', 'Selangor'], ['Subang Jaya', 'Selangor'],
  ['Cyberjaya', 'Selangor'], ['Kajang', 'Selangor'], ['Klang', 'Selangor'],
  ['Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur'],
  ['Putrajaya', 'Wilayah Persekutuan Putrajaya'], ['Seremban', 'Negeri Sembilan'],
  ['Melaka City', 'Melaka'], ['Johor Bahru', 'Johor'], ['Batu Pahat', 'Johor'],
  ['Muar', 'Johor'], ['Kota Kinabalu', 'Sabah'], ['Sandakan', 'Sabah'], ['Tawau', 'Sabah'],
  ['Kuching', 'Sarawak'], ['Sibu', 'Sarawak'], ['Miri', 'Sarawak'], ['Bintulu', 'Sarawak'],
  ['Labuan', 'Wilayah Persekutuan Labuan'],
];

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  cache.set(key, { createdAt: Date.now(), value });
  if (cache.size > 250) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function cleanQuery(value, max = 80) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function uniqByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.name}|${item.country || ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanLocationParts(name, ...parts) {
  const nameKey = String(name || '').trim().toLowerCase();
  const seen = new Set();
  return parts
    .flatMap(part => String(part || '').split(','))
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(part => !['university', 'educational institution', 'wikidata', 'hipolabs'].includes(part.toLowerCase()))
    .filter(part => part.toLowerCase() !== nameKey)
    .filter(part => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildLocation(name, ...parts) {
  return cleanLocationParts(name, ...parts).join(', ');
}

async function fetchJson(url, { timeoutMs = 4500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ReGenByZeeke/1.0 (institution lookup)',
      },
    });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchUniversities(query, country) {
  const params = new URLSearchParams({ name: query });
  if (country && country !== 'Worldwide') params.set('country', country);
  const data = await fetchJson(`${HIPO_URL}?${params.toString()}`);
  if (!Array.isArray(data)) return [];

  return data.slice(0, 12).map((item) => {
    const province = item['state-province'];
    const location = buildLocation(item.name, province, item.country);
    return {
      name: item.name || '',
      country: item.country || '',
      location,
      type: 'University',
      source: 'Hipolabs',
    };
  }).filter(item => item.name);
}

function wikidataQuery(query, country) {
  const safeQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"').toLowerCase();
  const countryId = WIKIDATA_COUNTRIES[country];
  const countryFilter = countryId
    ? `?item wdt:P17 wd:${countryId} . BIND(wd:${countryId} AS ?country)`
    : 'OPTIONAL { ?item wdt:P17 ?country . }';

  return `
SELECT DISTINCT ?item ?itemLabel ?countryLabel ?adminLabel WHERE {
  SERVICE wikibase:mwapi {
      bd:serviceParam wikibase:endpoint "www.wikidata.org";
                      wikibase:api "EntitySearch";
                      mwapi:search "${safeQuery}";
                      mwapi:language "en".
      ?item wikibase:apiOutputItem mwapi:item.
  }
  VALUES ?eduType { wd:Q2385804 wd:Q3914 wd:Q3918 wd:Q189004 wd:Q875538 }
  ?item wdt:P31/wdt:P279* ?eduType .
  ${countryFilter}
  OPTIONAL { ?item wdt:P131 ?admin . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ms". }
}
LIMIT 12`;
}

async function searchWikidataInstitutions(query, country) {
  const params = new URLSearchParams({
    format: 'json',
    query: wikidataQuery(query, country),
  });
  const data = await fetchJson(`${WIKIDATA_URL}?${params.toString()}`, { timeoutMs: 6000 });
  const rows = data?.results?.bindings;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const name = row.itemLabel?.value || '';
    const countryName = row.countryLabel?.value || (country === 'Malaysia' ? 'Malaysia' : '');
    const location = buildLocation(name, row.adminLabel?.value, countryName);
    return {
      name,
      country: countryName,
      location,
      type: 'Educational institution',
      source: 'Wikidata',
    };
  }).filter(item => item.name);
}

function localMalaysiaLocations(query) {
  const needle = query.toLowerCase();
  return MALAYSIA_PLACES
    .filter(([place, state]) => `${place} ${state}`.toLowerCase().includes(needle))
    .slice(0, 8)
    .map(([place, state]) => ({
      name: place,
      state,
      country: 'Malaysia',
      label: `${place}, ${state}, Malaysia`,
      source: 'Malaysia directory',
    }));
}

function wikidataLocationQuery(query, country) {
  const safeQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"').toLowerCase();
  const countryId = WIKIDATA_COUNTRIES[country];
  const countryFilter = countryId
    ? `?item wdt:P17 wd:${countryId} . BIND(wd:${countryId} AS ?country)`
    : 'OPTIONAL { ?item wdt:P17 ?country . }';

  return `
SELECT DISTINCT ?item ?itemLabel ?countryLabel ?adminLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search "${safeQuery}";
                    mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  VALUES ?placeType { wd:Q515 wd:Q3957 wd:Q532 wd:Q486972 wd:Q200250 wd:Q35657 wd:Q82794 }
  ?item wdt:P31/wdt:P279* ?placeType .
  ${countryFilter}
  OPTIONAL { ?item wdt:P131 ?admin . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ms". }
}
LIMIT 12`;
}

async function searchWikidataLocations(query, country) {
  const params = new URLSearchParams({ format: 'json', query: wikidataLocationQuery(query, country) });
  const data = await fetchJson(`${WIKIDATA_URL}?${params.toString()}`, { timeoutMs: 6000 });
  const rows = data?.results?.bindings;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const name = row.itemLabel?.value || '';
    const state = row.adminLabel?.value || '';
    const countryName = row.countryLabel?.value || (country === 'Malaysia' ? 'Malaysia' : '');
    return {
      name,
      state,
      country: countryName,
      label: buildLocation('', name, state, countryName),
      source: 'Wikidata',
    };
  }).filter(item => item.name && item.label)
    .filter(item => country === 'Worldwide' || !country || item.country.toLowerCase() === country.toLowerCase());
}

async function institutions(req, res) {
  const query = cleanQuery(req.query.q);
  const country = cleanQuery(req.query.country || 'Malaysia', 40) || 'Malaysia';

  if (query.length < 2) {
    return res.json({ success: true, results: [] });
  }

  const cacheKey = `inst:${country}:${query}`.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const [universities, institutions] = await Promise.all([
    searchUniversities(query, country),
    searchWikidataInstitutions(query, country),
  ]);

  const results = uniqByName([...universities, ...institutions]).slice(0, 18);
  setCached(cacheKey, results);
  res.json({ success: true, results });
}

async function locations(req, res) {
  const query = cleanQuery(req.query.q);
  const country = cleanQuery(req.query.country || 'Worldwide', 40) || 'Worldwide';
  if (query.length < 2) return res.json({ success: true, results: [] });

  const cacheKey = `location:${country}:${query}`.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const local = country === 'Malaysia' || country === 'Worldwide'
    ? localMalaysiaLocations(query)
    : [];
  if (country === 'Malaysia' && local.length) {
    setCached(cacheKey, local);
    return res.json({ success: true, results: local });
  }
  const remote = await searchWikidataLocations(query, country);
  const seen = new Set();
  const results = [...local, ...remote].filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);

  setCached(cacheKey, results);
  res.json({ success: true, results });
}

module.exports = { institutions, locations };
