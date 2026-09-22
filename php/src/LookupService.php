<?php
declare(strict_types=1);

namespace ReGen;

final class LookupService
{
    private const HIPO_URL = 'https://universities.hipolabs.com/search';
    private const WIKIDATA_URL = 'https://query.wikidata.org/sparql';
    private const CACHE_TTL = 43200;

    /** @var array<string, string> */
    private const COUNTRIES = [
        'Malaysia' => 'Q833',
        'Singapore' => 'Q334',
        'Indonesia' => 'Q252',
        'Thailand' => 'Q869',
        'Brunei' => 'Q921',
        'Philippines' => 'Q928',
        'United Kingdom' => 'Q145',
        'United States' => 'Q30',
        'Australia' => 'Q408',
        'New Zealand' => 'Q664',
        'Canada' => 'Q16',
        'India' => 'Q668',
        'China' => 'Q148',
        'Japan' => 'Q17',
        'South Korea' => 'Q884',
        'Germany' => 'Q183',
        'France' => 'Q142',
    ];

    /** @var list<array{0:string,1:string}> */
    private const MALAYSIA_PLACES = [
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

    public function __construct(private readonly string $cacheDirectory)
    {
    }

    /** @return list<array<string, string>> */
    public function institutions(string $rawQuery, string $rawCountry): array
    {
        $query = self::clean($rawQuery);
        $country = self::clean($rawCountry, 40) ?: 'Malaysia';
        if (mb_strlen($query) < 2) {
            return [];
        }

        $key = 'institution:' . mb_strtolower($country . ':' . $query);
        $cached = $this->readCache($key);
        if ($cached !== null) {
            return $cached;
        }

        $params = http_build_query([
            'name' => $query,
            ...($country !== 'Worldwide' ? ['country' => $country] : []),
        ]);
        $deadline = microtime(true) + 6.0;
        $hipo = $this->fetchJson(self::HIPO_URL . '?' . $params, 4);
        $results = [];
        if (is_array($hipo)) {
            foreach (array_slice($hipo, 0, 12) as $item) {
                if (!is_array($item) || trim((string) ($item['name'] ?? '')) === '') {
                    continue;
                }
                $name = self::clean($item['name']);
                $itemCountry = self::clean($item['country'] ?? '', 40);
                $province = self::clean($item['state-province'] ?? '', 80);
                $results[] = [
                    'name' => $name,
                    'country' => $itemCountry,
                    'location' => self::location($name, $province, $itemCountry),
                    'type' => 'University',
                    'source' => 'Hipolabs',
                ];
            }
        }

        $wikidata = [];
        $remainingSeconds = (int) floor($deadline - microtime(true));
        if (count($results) < 8 && $remainingSeconds >= 1) {
            $wikidata = $this->wikidataInstitutions(
                $query,
                $country,
                min(3, $remainingSeconds)
            );
        }
        $results = $this->uniqueBy($results, $wikidata, 'name', 18);
        $this->writeCache($key, $results);
        return $results;
    }

    /** @return list<array<string, string>> */
    public function locations(string $rawQuery, string $rawCountry): array
    {
        $query = self::clean($rawQuery);
        $country = self::clean($rawCountry, 40) ?: 'Worldwide';
        if (mb_strlen($query) < 2) {
            return [];
        }

        $key = 'location:' . mb_strtolower($country . ':' . $query);
        $cached = $this->readCache($key);
        if ($cached !== null) {
            return $cached;
        }

        $local = [];
        if ($country === 'Malaysia' || $country === 'Worldwide') {
            foreach (self::MALAYSIA_PLACES as [$place, $state]) {
                if (!str_contains(mb_strtolower($place . ' ' . $state), mb_strtolower($query))) {
                    continue;
                }
                $local[] = [
                    'name' => $place,
                    'state' => $state,
                    'country' => 'Malaysia',
                    'label' => $place . ', ' . $state . ', Malaysia',
                    'source' => 'Malaysia directory',
                ];
                if (count($local) >= 8) {
                    break;
                }
            }
        }

        if ($country === 'Malaysia' && $local !== []) {
            $this->writeCache($key, $local);
            return $local;
        }

        $remote = $this->wikidataLocations($query, $country);
        $results = $this->uniqueBy($local, $remote, 'label', 12);
        $this->writeCache($key, $results);
        return $results;
    }

    /** @return list<array<string, string>> */
    private function wikidataInstitutions(
        string $query,
        string $country,
        int $timeoutSeconds = 7,
    ): array
    {
        $safe = self::sparqlString(mb_strtolower($query));
        $countryId = self::COUNTRIES[$country] ?? '';
        $countryFilter = $countryId !== ''
            ? "?item wdt:P17 wd:{$countryId} . BIND(wd:{$countryId} AS ?country)"
            : 'OPTIONAL { ?item wdt:P17 ?country . }';
        $sparql = <<<SPARQL
SELECT DISTINCT ?item ?itemLabel ?countryLabel ?adminLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search "{$safe}";
                    mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  VALUES ?eduType { wd:Q2385804 wd:Q3914 wd:Q3918 wd:Q189004 wd:Q875538 }
  ?item wdt:P31/wdt:P279* ?eduType .
  {$countryFilter}
  OPTIONAL { ?item wdt:P131 ?admin . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ms". }
}
LIMIT 12
SPARQL;
        $data = $this->fetchWikidata($sparql, $timeoutSeconds);
        $results = [];
        foreach ($data as $row) {
            $name = self::binding($row, 'itemLabel');
            if ($name === '') {
                continue;
            }
            $countryName = self::binding($row, 'countryLabel') ?: ($country === 'Malaysia' ? 'Malaysia' : '');
            $results[] = [
                'name' => $name,
                'country' => $countryName,
                'location' => self::location($name, self::binding($row, 'adminLabel'), $countryName),
                'type' => 'Educational institution',
                'source' => 'Wikidata',
            ];
        }
        return $results;
    }

    /** @return list<array<string, string>> */
    private function wikidataLocations(string $query, string $country): array
    {
        $safe = self::sparqlString(mb_strtolower($query));
        $countryId = self::COUNTRIES[$country] ?? '';
        $countryFilter = $countryId !== ''
            ? "?item wdt:P17 wd:{$countryId} . BIND(wd:{$countryId} AS ?country)"
            : 'OPTIONAL { ?item wdt:P17 ?country . }';
        $sparql = <<<SPARQL
SELECT DISTINCT ?item ?itemLabel ?countryLabel ?adminLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search "{$safe}";
                    mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  VALUES ?placeType { wd:Q515 wd:Q3957 wd:Q532 wd:Q486972 wd:Q200250 wd:Q35657 wd:Q82794 }
  ?item wdt:P31/wdt:P279* ?placeType .
  {$countryFilter}
  OPTIONAL { ?item wdt:P131 ?admin . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ms". }
}
LIMIT 12
SPARQL;
        $data = $this->fetchWikidata($sparql);
        $results = [];
        foreach ($data as $row) {
            $name = self::binding($row, 'itemLabel');
            $state = self::binding($row, 'adminLabel');
            $countryName = self::binding($row, 'countryLabel') ?: ($country === 'Malaysia' ? 'Malaysia' : '');
            if ($name === '' || ($country !== 'Worldwide' && strcasecmp($countryName, $country) !== 0)) {
                continue;
            }
            $results[] = [
                'name' => $name,
                'state' => $state,
                'country' => $countryName,
                'label' => self::location('', $name, $state, $countryName),
                'source' => 'Wikidata',
            ];
        }
        return $results;
    }

    /** @return list<array<string, mixed>> */
    private function fetchWikidata(string $query, int $timeoutSeconds = 7): array
    {
        $url = self::WIKIDATA_URL . '?' . http_build_query(['format' => 'json', 'query' => $query]);
        $data = $this->fetchJson($url, max(1, min(7, $timeoutSeconds)));
        $rows = $data['results']['bindings'] ?? [];
        return is_array($rows) ? array_values(array_filter($rows, 'is_array')) : [];
    }

    private function fetchJson(string $url, int $timeoutSeconds): mixed
    {
        if (!function_exists('curl_init')) {
            return null;
        }
        $curl = curl_init($url);
        if ($curl === false) {
            return null;
        }
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'User-Agent: ' . Config::get('lookup.user_agent', 'ReGenByZeeke/1.0'),
            ],
        ]);
        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        if (
            !is_string($body)
            || strlen($body) > 1024 * 1024
            || $status < 200
            || $status >= 300
        ) {
            return null;
        }
        return json_decode($body, true);
    }

    /** @param list<array<string, string>> $first
     *  @param list<array<string, string>> $second
     *  @return list<array<string, string>>
     */
    private function uniqueBy(array $first, array $second, string $key, int $limit): array
    {
        $seen = [];
        $results = [];
        foreach ([...$first, ...$second] as $item) {
            $identity = mb_strtolower(trim((string) ($item[$key] ?? '')));
            if ($identity === '' || isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;
            $results[] = $item;
            if (count($results) >= $limit) {
                break;
            }
        }
        return $results;
    }

    /** @return list<array<string, string>>|null */
    private function readCache(string $key): ?array
    {
        $path = $this->cachePath($key);
        if (!is_file($path) || filemtime($path) < time() - self::CACHE_TTL) {
            return null;
        }
        $decoded = json_decode((string) file_get_contents($path), true);
        return is_array($decoded) ? $decoded : null;
    }

    /** @param list<array<string, string>> $value */
    private function writeCache(string $key, array $value): void
    {
        if (!is_dir($this->cacheDirectory)) {
            @mkdir($this->cacheDirectory, 0700, true);
        }
        if (!is_dir($this->cacheDirectory) || !is_writable($this->cacheDirectory)) {
            return;
        }
        @file_put_contents(
            $this->cachePath($key),
            json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            LOCK_EX
        );
    }

    private function cachePath(string $key): string
    {
        return rtrim($this->cacheDirectory, '/\\') . '/' . hash('sha256', $key) . '.json';
    }

    private static function clean(mixed $value, int $max = 80): string
    {
        return Sanitizer::cleanText($value, false, $max);
    }

    private static function sparqlString(string $value): string
    {
        return str_replace(['\\', '"'], ['\\\\', '\\"'], $value);
    }

    /** @param array<string, mixed> $row */
    private static function binding(array $row, string $key): string
    {
        return self::clean($row[$key]['value'] ?? '', 200);
    }

    private static function location(string $name, mixed ...$parts): string
    {
        $nameKey = mb_strtolower(trim($name));
        $seen = [];
        $result = [];
        foreach ($parts as $part) {
            foreach (explode(',', (string) $part) as $candidate) {
                $candidate = self::clean($candidate, 150);
                $key = mb_strtolower($candidate);
                if ($candidate === '' || $key === $nameKey || isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $result[] = $candidate;
            }
        }
        return implode(', ', $result);
    }
}
