<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

/** Only explicitly saved coaching preferences live here. No chat transcript. */
final class MochiProfile
{
    public const DEFAULTS = [
        'nickname'=>'','goal'=>'','stage'=>'','tone'=>'playful','language'=>'auto',
        'intro'=>'new','asleep'=>false,'live'=>false,'napUntil'=>0,
    ];
    private const STAGES = ['', 'student', 'first-job', 'working', 'career-change'];
    private const TONES = ['playful','gentle','direct'];
    private const LANGUAGES = ['auto','en','ms'];

    public function __construct(private readonly PDO $db) {}

    public function get(int $userId): array
    {
        $query = $this->db->prepare('SELECT preferences FROM mochi_profiles WHERE user_id=?');
        $query->execute([$userId]);
        return self::fromJson($query->fetchColumn());
    }

    public function save(int $userId, array $change): array
    {
        $this->db->beginTransaction();
        try {
            $this->db->prepare("INSERT IGNORE INTO mochi_profiles (user_id,preferences) VALUES (?,'{}')")->execute([$userId]);
            $query = $this->db->prepare('SELECT preferences FROM mochi_profiles WHERE user_id=? FOR UPDATE');
            $query->execute([$userId]);
            $current = self::fromJson($query->fetchColumn());
            $next = self::change($current, $change);
            // An opt-in to local inference does not authorize sending excerpts to OpenAI.
            $stored = $next;
            $stored['liveOpenAi'] = $stored['live'];
            unset($stored['live']);
            $this->db->prepare('UPDATE mochi_profiles SET preferences=? WHERE user_id=?')
                ->execute([json_encode($stored, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),$userId]);
            $this->db->commit();
            return $next;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public static function change(array $current, array $change): array
    {
        $action = $change['action'] ?? null;
        if (!is_string($action)) throw new \DomainException('Choose valid Mochi preferences.');
        switch ($action) {
            case 'introduce':
                $details = $change['details'] ?? null;
                if (!is_array($details) || !is_string($details['nickname'] ?? null) || !is_string($details['goal'] ?? null)
                    || !in_array($details['stage'] ?? null,self::STAGES,true)
                    || !in_array($details['tone'] ?? null,self::TONES,true)
                    || !in_array($details['language'] ?? null,self::LANGUAGES,true)) break;
                return array_replace($current, [
                    'nickname'=>MochiCoach::redact(Sanitizer::cleanText($details['nickname'],false,40)),
                    'goal'=>MochiCoach::redact(Sanitizer::cleanText($details['goal'],false,150)),
                    'stage'=>$details['stage'],'tone'=>$details['tone'],'language'=>$details['language'],'intro'=>'known',
                ]);
            case 'skip':
                return array_replace($current,['intro'=>'skipped']);
            case 'nap':
                if ($current['asleep'] || (int)($current['napUntil'] ?? 0) > time()-90) return $current;
                return array_replace($current,['napUntil'=>time()+random_int(28,48)]);
            case 'sleep':
            case 'live':
                if (!is_bool($change['enabled'] ?? null)) break;
                if ($action==='sleep' && !$change['enabled'] && (int)($current['napUntil'] ?? 0)>time()) return $current;
                return array_replace($current,[$action==='sleep'?'asleep':'live'=>$change['enabled']]);
            case 'forget':
                // Forgetting memory never opts the user into field sharing or wakes Mochi.
                return array_replace(self::DEFAULTS,['asleep'=>$current['asleep'],'napUntil'=>$current['napUntil']??0]);
        }
        throw new \DomainException('Choose valid Mochi preferences.');
    }

    private static function fromJson(mixed $value): array
    {
        $saved = is_string($value) ? json_decode($value,true) : null;
        if (!is_array($saved)) return self::DEFAULTS;
        $saved['live'] = ($saved['liveOpenAi'] ?? false) === true;
        return array_replace(self::DEFAULTS, array_intersect_key($saved,self::DEFAULTS));
    }
}
