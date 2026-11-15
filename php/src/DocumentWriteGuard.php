<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class DocumentWriteGuard
{
    public static function generation(PDO $db,int $userId): int
    {
        $q=$db->prepare('SELECT generation FROM document_generations WHERE user_id=?');$q->execute([$userId]);return (int)$q->fetchColumn();
    }
    public static function run(PDO $db,int $userId,callable $write): mixed
    {
        $own=!$db->inTransaction();if($own)$db->beginTransaction();
        try {
            $q=$db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$q->execute([$userId]);
            if(!$q->fetchColumn())throw new \DomainException('User not found.');
            if(Session::authenticated() && Session::userId()===$userId) {
                $value=(string)($_SERVER['HTTP_X_DOCUMENT_GENERATION']??'0');
                if(!ctype_digit($value)||(int)$value!==self::generation($db,$userId))throw new DocumentRecoveryConflict('Your documents were recovered after this editor was opened. Copy any unsaved writing, then reopen the document before saving.');
            }
            $result=$write();
            (new RealtimeEvents($db))->publish('documents','user',$userId);
            if($own)$db->commit();return $result;
        }catch(\Throwable $e){if($own&&$db->inTransaction())$db->rollBack();throw $e;}
    }
}
