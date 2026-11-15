<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class PasswordResetService
{
    public function __construct(private readonly PDO $db) {}
    public function issue(int $userId): string
    {
        $token=EmailVerificationService::createToken();
        $this->db->prepare('INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE)) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),expires_at=VALUES(expires_at)')->execute([$userId,EmailVerificationService::hashToken($token)]);
        return $token;
    }
    public function consume(string $token,string $password): bool
    {
        if(!EmailVerificationService::validToken($token) || strlen($password)<10 || strlen($password)>128)return false;
        $this->db->beginTransaction();
        try {
            $q=$this->db->prepare('SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE'); $q->execute([EmailVerificationService::hashToken($token)]); $id=(int)$q->fetchColumn();
            if(!$id){$this->db->rollBack();return false;}
            $q=$this->db->prepare("UPDATE users SET password_hash=? WHERE id=? AND account_status='active'"); $q->execute([password_hash($password,PASSWORD_DEFAULT),$id]);
            if(!$q->rowCount()){$this->db->rollBack();return false;}
            $this->db->prepare('DELETE FROM password_reset_tokens WHERE user_id=?')->execute([$id]);
            (new AccountRepository($this->db))->revokeAllForUser($id);
            (new NotificationService($this->db))->notify($id,'security','Password reset completed','Your account password was reset and all existing devices were signed out. Contact Support if you did not request this.');
            (new AuditLogger($this->db))->log('auth.password_reset_completed','user',$id);
            $this->db->commit(); return true;
        }catch(\Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }
}
