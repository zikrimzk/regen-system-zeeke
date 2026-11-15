<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class BonusCreditService
{
    public function __construct(private readonly PDO $db) {}

    public function balance(int $userId): array
    {
        $query = $this->db->prepare('SELECT balance FROM ai_bonus_wallets WHERE user_id = ?');
        $query->execute([$userId]);
        $balance = (int) $query->fetchColumn();
        $query = $this->db->prepare('SELECT COALESCE(SUM(bonus_cost),0) FROM ai_usage_reservations WHERE user_id = ? AND is_hold = 1 AND expires_at > ?');
        $query->execute([$userId, time()]);
        $reserved = (int) $query->fetchColumn();
        return ['balance' => $balance, 'reserved' => $reserved, 'available' => max(0, $balance - $reserved)];
    }

    /** SERIALIZE ACCOUNT MUTATIONS BEFORE WALLET MUTATIONS, INCLUDING REWARDS AND REFUNDS. */
    public function lock(int $userId): int
    {
        if (!$this->db->inTransaction()) throw new \LogicException('Wallet locks require a transaction.');
        $query = $this->db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
        $query->execute([$userId]);
        if (!$query->fetchColumn()) throw new \OutOfBoundsException('Account not found.');
        // IGNORE WOULD TAKE A SHARED DUPLICATE-KEY LOCK AND CAN DEADLOCK ON LOCK UPGRADE.
        $this->db->prepare('INSERT INTO ai_bonus_wallets (user_id,balance) VALUES (?,0) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)')->execute([$userId]);
        $query = $this->db->prepare('SELECT balance FROM ai_bonus_wallets WHERE user_id=? FOR UPDATE');
        $query->execute([$userId]);
        return (int) $query->fetchColumn();
    }

    public function adjust(int $userId, int $amount, string $reason, string $source, string $key, ?int $adminId = null): array
    {
        if ($amount === 0 || abs($amount) > 10000 || trim($reason) === '') {
            throw new \DomainException('Enter a non-zero adjustment from -10,000 to 10,000 and explain the reason.');
        }
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) $this->db->beginTransaction();
        try {
            $current = $this->lock($userId);
            $query = $this->db->prepare('SELECT user_id,amount,balance_after FROM ai_bonus_ledger WHERE request_key = ?');
            $query->execute([$key]);
            $existing = $query->fetch();
            if ($existing) {
                if ((int)$existing['user_id'] !== $userId || (int)$existing['amount'] !== $amount) throw new \DomainException('This adjustment reference was already used.');
                if ($ownsTransaction) $this->db->commit();
                return ['balance' => (int)$existing['balance_after'], 'duplicate' => true];
            }
            $available = $this->balance($userId)['available'];
            if ($amount < 0 && $available + $amount < 0) throw new \DomainException('An adjustment cannot remove credits that are spent or reserved by a generation.');
            if ($current + $amount > 1000000) throw new \DomainException('The bonus balance exceeds the supported limit.');
            $next = $current + $amount;
            $this->db->prepare('UPDATE ai_bonus_wallets SET balance = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?')->execute([$next, $userId]);
            $this->db->prepare('INSERT INTO ai_bonus_ledger (user_id,amount,balance_after,reason,source,request_key,admin_id) VALUES (?,?,?,?,?,?,?)')
                ->execute([$userId, $amount, $next, mb_substr($reason,0,300), $source, $key, $adminId]);
            (new RealtimeEvents($this->db))->publish('wallet','user',$userId);
            if ($ownsTransaction) $this->db->commit();
            return ['balance' => $next, 'duplicate' => false];
        } catch (\Throwable $error) {
            if ($ownsTransaction && $this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function history(int $userId,int $page=1): array
    {
        $page=max(1,$page);$count=$this->db->prepare('SELECT COUNT(*) FROM ai_bonus_ledger WHERE user_id=?');$count->execute([$userId]);$total=(int)$count->fetchColumn();
        $query = $this->db->prepare('SELECT id,amount,balance_after,reason,source,admin_id,created_at FROM ai_bonus_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 10 OFFSET '.min(100000,($page-1)*10));
        $query->execute([$userId]);
        return ['wallet' => $this->balance($userId), 'ledger' => $query->fetchAll(),'total'=>$total,'page'=>$page,'pageSize'=>10];
    }
}
