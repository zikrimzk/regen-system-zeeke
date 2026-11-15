<?php
declare(strict_types=1);

namespace ReGen;

final class InstitutionDirectory
{
    // Malaysian Qualifications Register: https://www.mqa.gov.my/mqr/english/eakrbyipta.cfm
    // Private institutions: https://www.mqa.gov.my/mqr/english/eakrbyipts.cfm
    // Keep separate campus records where the same institution spans multiple states.
    private const MALAYSIA = [
        ['Universiti Malaya', 'Kuala Lumpur', 'UM|University of Malaya'],
        ['Universiti Kebangsaan Malaysia', 'Bangi, Selangor', 'UKM|UKM Bangi|National University of Malaysia'],
        ['Universiti Kebangsaan Malaysia (Kuala Lumpur)', 'Kuala Lumpur', 'UKM|UKM KL'],
        ['Universiti Putra Malaysia', 'Serdang, Selangor', 'UPM|UPM Serdang'],
        ['Universiti Putra Malaysia (Bintulu)', 'Bintulu, Sarawak', 'UPM|UPM Sarawak'],
        ['Universiti Sains Malaysia', 'Pulau Pinang', 'USM|USM Penang'],
        ['Universiti Sains Malaysia (Engineering Campus)', 'Pulau Pinang', 'USM|USM Nibong Tebal'],
        ['Universiti Sains Malaysia (Health Campus)', 'Kelantan', 'USM|USM Kubang Kerian'],
        ['Universiti Teknologi Malaysia', 'Skudai, Johor', 'UTM|UTM Skudai|UTM Johor Bahru|University of Technology Malaysia'],
        ['Universiti Teknologi Malaysia (Kuala Lumpur)', 'Kuala Lumpur', 'UTM|UTM KL'],
        ['Universiti Teknologi Malaysia (Pagoh)', 'Pagoh, Johor', 'UTM'],
        ['Universiti Teknologi MARA (Shah Alam)', 'Shah Alam, Selangor', 'UiTM'],
        ['Universiti Teknologi MARA (Puncak Alam)', 'Puncak Alam, Selangor', 'UiTM'],
        ['Universiti Teknologi MARA (Dengkil)', 'Dengkil, Selangor', 'UiTM'],
        ['Universiti Teknologi MARA (Arau)', 'Perlis', 'UiTM'],
        ['Universiti Teknologi MARA (Sungai Petani)', 'Kedah', 'UiTM'],
        ['Universiti Teknologi MARA (Permatang Pauh)', 'Pulau Pinang', 'UiTM'],
        ['Universiti Teknologi MARA (Seri Iskandar)', 'Perak', 'UiTM'],
        ['Universiti Teknologi MARA (Rembau)', 'Negeri Sembilan', 'UiTM'],
        ['Universiti Teknologi MARA (Alor Gajah)', 'Melaka', 'UiTM'],
        ['Universiti Teknologi MARA (Jasin)', 'Melaka', 'UiTM'],
        ['Universiti Teknologi MARA (Segamat)', 'Johor', 'UiTM'],
        ['Universiti Teknologi MARA (Pasir Gudang)', 'Johor', 'UiTM'],
        ['Universiti Teknologi MARA (Machang)', 'Kelantan', 'UiTM'],
        ['Universiti Teknologi MARA (Jengka)', 'Pahang', 'UiTM'],
        ['Universiti Teknologi MARA (Dungun)', 'Terengganu', 'UiTM'],
        ['Universiti Teknologi MARA (Kota Kinabalu)', 'Sabah', 'UiTM'],
        ['Universiti Teknologi MARA (Samarahan)', 'Sarawak', 'UiTM'],
        ['International Islamic University Malaysia (Gombak)', 'Selangor', 'IIUM|UIAM|UIA|Universiti Islam Antarabangsa Malaysia'],
        ['International Islamic University Malaysia (Kuantan)', 'Pahang', 'IIUM|UIAM|UIA|Universiti Islam Antarabangsa Malaysia'],
        ['Universiti Pendidikan Sultan Idris', 'Perak', 'UPSI|Sultan Idris Education University'],
        ['Universiti Utara Malaysia', 'Kedah', 'UUM|UUM Sintok'],
        ['Universiti Utara Malaysia (Kuala Lumpur)', 'Kuala Lumpur', 'UUM|UUM KL'],
        ['Universiti Malaysia Sabah', 'Sabah', 'UMS'],
        ['Universiti Malaysia Sarawak', 'Sarawak', 'UNIMAS'],
        ['Universiti Malaysia Perlis', 'Perlis', 'UniMAP'],
        ['Universiti Malaysia Kelantan', 'Kelantan', 'UMK'],
        ['Universiti Malaysia Terengganu', 'Terengganu', 'UMT'],
        ['Universiti Malaysia Pahang Al-Sultan Abdullah', 'Pahang', 'UMPSA|UMP|Universiti Malaysia Pahang'],
        ['Universiti Pertahanan Nasional Malaysia', 'Kuala Lumpur', 'UPNM|National Defence University of Malaysia'],
        ['Universiti Sains Islam Malaysia', 'Negeri Sembilan', 'USIM'],
        ['Universiti Sultan Zainal Abidin', 'Terengganu', 'UniSZA'],
        ['Universiti Teknikal Malaysia Melaka', 'Melaka', 'UTeM'],
        ['Universiti Tun Hussein Onn Malaysia', 'Johor', 'UTHM'],
        ['Universiti Teknologi PETRONAS', 'Seri Iskandar, Perak', 'UTP|UTP Seri Iskandar'],
        ['Multimedia University (Cyberjaya)', 'Cyberjaya, Selangor', 'MMU'],
        ['Multimedia University (Melaka)', 'Melaka', 'MMU|MMU Malacca'],
        ['Universiti Tunku Abdul Rahman (Kampar)', 'Kampar, Perak', 'UTAR'],
        ['Universiti Tunku Abdul Rahman (Sungai Long)', 'Sungai Long, Selangor', 'UTAR'],
        ['Universiti Tenaga Nasional (Putrajaya Campus)', 'Selangor', 'UNITEN'],
        ['Universiti Tenaga Nasional (Sultan Haji Ahmad Shah Campus)', 'Pahang', 'UNITEN|UNITEN Muadzam Shah'],
        ['Sunway University', 'Selangor', 'Sunway'],
        ["Taylor's University", 'Selangor', 'Taylors University|Taylor’s University'],
        ['Monash University Malaysia', 'Selangor', 'Monash'],
        ['University of Nottingham Malaysia', 'Selangor', 'UNM|Nottingham'],
        ['Asia Pacific University of Technology & Innovation', 'Kuala Lumpur', 'APU|Asia Pacific University'],
        ['Tunku Abdul Rahman University of Management and Technology (Kuala Lumpur)', 'Kuala Lumpur', 'TAR UMT|TAR UC|TAR College'],
        ['Universiti Kuala Lumpur (City Campus)', 'Kuala Lumpur', 'UniKL|UniKL Business School'],
        ['Management and Science University', 'Selangor', 'MSU'],
        ['INTI International University', 'Negeri Sembilan', 'INTI|INTI Nilai'],
        ['UCSI University (Kuala Lumpur)', 'Kuala Lumpur', 'UCSI'],
        ['UCSI University (Kuching)', 'Sarawak', 'UCSI'],
        ['Swinburne University of Technology Sarawak', 'Sarawak', 'Swinburne'],
        ['Curtin University Malaysia', 'Sarawak', 'Curtin'],
    ];

    public static function search(string $query, string $country): array
    {
        $query = self::key($query);
        if (mb_strlen($query) < 2 || !in_array(mb_strtolower($country), ['', 'worldwide', 'malaysia'], true)) return [];

        $matches = [];
        foreach (self::MALAYSIA as [$name, $location, $aliases]) {
            $keys = array_map(self::key(...), [$name, ...explode('|', $aliases)]);
            $tokens = explode(' ', $query);
            $context = self::key($name.' '.$location);
            $score = 0;
            foreach ($keys as $key) {
                $score = max($score, match (true) {
                    $key === $query => 3,
                    str_starts_with($key, $query) => 2,
                    str_contains($key, $query) => 1,
                    count(array_diff($tokens, explode(' ', $key.' '.$context))) === 0 => 1,
                    default => 0,
                });
            }
            if ($score) $matches[] = ['name' => $name, 'country' => 'Malaysia', 'location' => $location, 'score' => $score];
        }
        usort($matches, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);
        return array_map(static fn(array $row): array => array_diff_key($row, ['score' => true]), array_slice($matches, 0, 8));
    }

    private static function key(string $text): string
    {
        return trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower($text)) ?? '');
    }
}
