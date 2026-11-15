<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

final class PaymentOrders
{
    private const PAGE_SIZE = 15;
    private const CREATE_TIMEOUT_SECONDS = 30;
    private const HISTORY_SELECT = 'SELECT reference,user_id,package_name,amount_minor,currency,gateway_mode,state,
        checkout_url,link_expires_at,created_at,paid_at,refunded_minor,grant_id,gateway_request_id,gateway_charge_id FROM payment_orders';

    public function __construct(private readonly PDO $db) {}

    public static function validReference(mixed $reference): bool
    {
        return is_string($reference) && preg_match('/^RG-[a-f0-9]{32}$/D', $reference) === 1;
    }

    public function start(int $userId, array $input, string $mode, callable $createRequest): array
    {
        if (!in_array($mode, HitPay::MODES, true)) throw new \LogicException('Unsupported payment environment.');
        $packageId = $input['packageId'] ?? null;
        $requestKey = $input['requestKey'] ?? null;
        if (!is_int($packageId) || $packageId < 1 || !HitPay::uuid($requestKey)
            || !is_int($input['version'] ?? null) || !is_int($input['amountMinor'] ?? null)) {
            throw new \DomainException('Review the package before starting checkout.');
        }
        [$order, $create] = $this->reserve($userId, $packageId, $requestKey, $mode, $input);
        if (!$create) return $this->present($order);

        // Never hold a database transaction or PHP session open during the provider call.
        $stage = 'create_request';
        $checkoutUrlIssue = null;
        try {
            $remote = $createRequest($order);
            $stage = 'validate_response';
            $gatewayId = $remote['id'] ?? null;
            $url = $remote['url'] ?? null;
            $checkoutUrlIssue = HitPay::checkoutUrlIssue($url, $mode);
            $invalidResponse = match (true) {
                !HitPay::uuid($gatewayId) => 'invalid_request_id',
                $checkoutUrlIssue !== null => 'invalid_checkout_url',
                !$this->matchesQuote($order, $remote) => 'quote_mismatch',
                ($remote['status'] ?? '') !== 'pending' => 'unexpected_status',
                default => null,
            };
            if ($invalidResponse !== null) {
                throw new HitPayCheckoutException($invalidResponse);
            }
            $stage = 'save_checkout';
            $order['link_expires_at'] = gmdate('Y-m-d H:i:s', time() + HitPay::LINK_MINUTES * 60);
            $update = $this->db->prepare("UPDATE payment_orders SET state='pending',gateway_request_id=?,checkout_url=?,link_expires_at=?
                WHERE id=? AND state='creating' AND created_at>?");
            $update->execute([$gatewayId, $url, $order['link_expires_at'], $order['id'], gmdate('Y-m-d H:i:s',time()-self::CREATE_TIMEOUT_SECONDS)]);
            if ($update->rowCount() !== 1) throw new HitPayCheckoutException('checkout_window_closed');
            $order['state'] = 'pending';
            $order['checkout_url'] = $url;
        } catch (\Throwable $error) {
            $reason = $error instanceof HitPayCheckoutException ? $error->reason : $error::class;
            $log = '[HitPay checkout] '.$order['reference'].' mode='.$mode.' stage='.$stage.' reason='.$reason;
            if ($error instanceof HitPayCheckoutException) {
                if ($error->curlError !== null) $log .= ' curl_errno='.$error->curlError;
                if ($error->httpStatus !== null) $log .= ' http_status='.$error->httpStatus;
                if ($error->httpStatus === 422) $log .= ' validation_fields='.($error->validationFields === [] ? 'unknown' : implode(',', $error->validationFields));
                if ($reason === 'invalid_checkout_url' && $checkoutUrlIssue !== null) {
                    $log .= ' checkout_url_issue='.$checkoutUrlIssue;
                }
            }
            error_log($log);
            $this->db->prepare("UPDATE payment_orders SET state='unavailable' WHERE id=? AND state='creating'")->execute([$order['id']]);
            $order['state'] = 'unavailable';
        }
        return $this->present($order);
    }

    private function reserve(int $userId, int $packageId, string $requestKey, string $mode, array $input): array
    {
        $this->db->beginTransaction();
        try {
            $account = $this->db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
            $account->execute([$userId]);
            if (!$account->fetchColumn()) throw new \OutOfBoundsException('Account not found.');
            $existing = $this->db->prepare('SELECT * FROM payment_orders WHERE user_id=? AND request_key=?');
            $existing->execute([$userId, $requestKey]);
            if ($order = $existing->fetch()) {
                if ((int)$order['package_id'] !== $packageId || $order['gateway_mode'] !== $mode) {
                    throw new ConcurrentUpdate('Start a new checkout for this package.');
                }
                $this->db->commit();
                return [$order, false];
            }
            $open = $this->db->prepare("SELECT * FROM payment_orders WHERE user_id=? AND package_id=? AND gateway_mode=?
                AND state IN ('creating','pending','failed') AND link_expires_at>UTC_TIMESTAMP()
                AND (state<>'creating' OR created_at>?) ORDER BY id DESC LIMIT 1");
            $open->execute([$userId, $packageId, $mode, gmdate('Y-m-d H:i:s',time()-self::CREATE_TIMEOUT_SECONDS)]);
            if ($order = $open->fetch()) {
                if ((int)$order['amount_minor'] !== $input['amountMinor'] || (int)$order['package_version'] !== $input['version']) {
                    throw new ConcurrentUpdate('You have an open checkout for this package. Review it in Payment history.');
                }
                $this->db->commit();
                return [$order, false];
            }

            if (!(new TokenStore($this->db))->policy()['enabled']) throw new \DomainException('The store is paused.');
            $packageQuery = $this->db->prepare('SELECT * FROM token_packages WHERE id=? AND active=1 LOCK IN SHARE MODE');
            $packageQuery->execute([$packageId]);
            $package = $packageQuery->fetch();
            if (!$package || $package['claim_enabled']) throw new \DomainException('This package is unavailable for purchase.');
            $price = (int) TokenStore::promotion($package)['display_price_minor'];
            if ($price < 30) throw new \DomainException('This package is unavailable for paid checkout.');
            if ((int)$package['version'] !== $input['version'] || $price !== $input['amountMinor']) {
                throw new ConcurrentUpdate('The package price or benefits changed. Review the latest offer.');
            }
            $order = [
                'reference' => 'RG-'.bin2hex(random_bytes(16)),
                'package_name' => $package['name'],
                'amount_minor' => $price,
                'currency' => $package['currency'],
                'gateway_mode' => $mode,
                'state' => 'creating',
                'link_expires_at' => gmdate('Y-m-d H:i:s', time() + HitPay::LINK_MINUTES * 60),
                'created_at' => gmdate('Y-m-d H:i:s'),
            ];
            $snapshot = array_intersect_key($package, array_flip(['name','tokens','bonus_tokens','validity_days','features_json','template_tiers']));
            $this->db->prepare('INSERT INTO payment_orders (reference,user_id,package_id,package_version,package_name,benefits_json,amount_minor,currency,gateway_mode,request_key,link_expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([$order['reference'],$userId,$packageId,$package['version'],$order['package_name'],json_encode($snapshot,JSON_THROW_ON_ERROR),$price,$order['currency'],$mode,$requestKey,$order['link_expires_at']]);
            $order['id'] = (int)$this->db->lastInsertId();
            $this->db->commit();
            return [$order, true];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function matchesQuote(array $order, array $remote): bool
    {
        return ($remote['reference_number'] ?? null) === $order['reference']
            && $this->matchesAmount($order, $remote);
    }

    private function matchesAmount(array $order, array $remote): bool
    {
        return is_string($remote['currency'] ?? null) && strtoupper($remote['currency']) === $order['currency']
            && HitPay::minor($remote['amount'] ?? null) === (int)$order['amount_minor'];
    }

    /** Called only after verifying the raw HitPay event and its environment's salt. */
    public function applyEvent(string $mode, string $event, array $payload): void
    {
        if ($event === 'charge.updated') {
            $this->recordRefund($mode, $payload);
            return;
        }
        if (!in_array($event, ['payment_request.completed', 'payment_request.failed'], true)) return;
        $reference = $payload['reference_number'] ?? null;
        if (!self::validReference($reference)) return; // Other sales in the same merchant account.
        $find = $this->db->prepare('SELECT id,user_id FROM payment_orders WHERE reference=? AND gateway_mode=?');
        $find->execute([$reference, $mode]);
        $found = $find->fetch();
        if (!$found) return;

        $this->db->beginTransaction();
        try {
            // Keep the lock order consistent with checkout and all account mutations.
            if ($found['user_id'] !== null) {
                $account = $this->db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
                $account->execute([$found['user_id']]);
                $account->fetchColumn();
            }
            $locked = $this->db->prepare('SELECT * FROM payment_orders WHERE id=? FOR UPDATE');
            $locked->execute([$found['id']]);
            $order = $locked->fetch();
            if (!$order || !HitPay::uuid($order['gateway_request_id'])
                || ($payload['id'] ?? null) !== $order['gateway_request_id'] || !$this->matchesQuote($order, $payload)) {
                throw new \DomainException('Payment confirmation does not match its order.');
            }
            if ($order['state'] !== 'paid') {
                if ($event === 'payment_request.completed' && ($payload['status'] ?? null) === 'completed') {
                    $this->fulfill($order, $payload);
                } elseif ($event === 'payment_request.failed' && ($payload['status'] ?? null) === 'failed') {
                    $this->db->prepare("UPDATE payment_orders SET state='failed' WHERE id=?")->execute([$order['id']]);
                }
            }
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function fulfill(array $order, array $payload): void
    {
        $payments = $payload['payments'] ?? null;
        $successful = is_array($payments) ? array_values(array_filter($payments, static fn($p) => is_array($p) && ($p['status'] ?? '') === 'succeeded')) : [];
        $charge = $successful[0] ?? [];
        if (count($successful) !== 1 || !HitPay::uuid($charge['id'] ?? null) || !$this->matchesAmount($order, $charge)
            || ($order['gateway_charge_id'] !== null && $charge['id'] !== $order['gateway_charge_id'])) {
            throw new \DomainException('Payment charge does not match its order.');
        }
        $refunded = HitPay::minor($charge['refunded_amount'] ?? 0);
        if ($refunded === null || $refunded > (int)$order['amount_minor']) throw new \DomainException('Invalid refund amount.');
        $refunded = max($refunded, (int)$order['refunded_minor']);
        $grant = null;
        if ($order['user_id'] !== null && $refunded < (int)$order['amount_minor']) {
            $grant = (new PackageAccess($this->db))->grantPurchase(
                (int)$order['user_id'],
                $order['package_id'] === null ? null : (int)$order['package_id'],
                json_decode($order['benefits_json'], true, 16, JSON_THROW_ON_ERROR),
                $order['reference']
            );
        }
        $this->db->prepare("UPDATE payment_orders SET state='paid',gateway_charge_id=?,grant_id=?,refunded_minor=?,paid_at=UTC_TIMESTAMP(),checkout_url=NULL WHERE id=?")
            ->execute([$charge['id'],$grant,$refunded,$order['id']]);
        if ($grant !== null) {
            (new NotificationService($this->db))->paymentReceipt(
                (int) $order['user_id'], $order['reference'], $order['package_name'],
                $order['currency'], (int) $order['amount_minor'], $refunded
            );
        }
        (new AuditLogger($this->db))->log('store.hitpay_payment_confirmed','payment_order',$order['reference'],
            ['mode'=>$order['gateway_mode'],'amountMinor'=>(int)$order['amount_minor'],'currency'=>$order['currency'],'grantId'=>$grant],'system',null);
    }

    private function recordRefund(string $mode, array $payload): void
    {
        $charge = $payload['id'] ?? null;
        $request = $payload['payment_request_id'] ?? null;
        $refunded = HitPay::minor($payload['refunded_amount'] ?? null);
        $amount = HitPay::minor($payload['amount'] ?? null);
        $currency = $payload['currency'] ?? null;
        if (!HitPay::uuid($charge) || !$refunded || $amount === null || $refunded > $amount || !is_string($currency)) return;
        $where = HitPay::uuid($request)
            ? '(gateway_request_id=? AND (gateway_charge_id IS NULL OR gateway_charge_id=?))'
            : 'gateway_charge_id=?';
        $identity = HitPay::uuid($request) ? [$request,$charge] : [$charge];
        $this->db->prepare("UPDATE payment_orders SET refunded_minor=GREATEST(refunded_minor,?),gateway_charge_id=?
            WHERE gateway_mode=? AND amount_minor=? AND currency=? AND ".$where)
            ->execute([$refunded,$charge,$mode,$amount,strtoupper($currency),...$identity]);
    }

    private function statusSql(): string
    {
        return "CASE
            WHEN state='paid' AND refunded_minor>=amount_minor THEN 'refunded'
            WHEN state='paid' AND refunded_minor>0 THEN 'partially_refunded'
            WHEN state='creating' AND created_at<=UTC_TIMESTAMP()-INTERVAL ".self::CREATE_TIMEOUT_SECONDS." SECOND THEN 'unavailable'
            WHEN state='pending' AND link_expires_at<=UTC_TIMESTAMP() THEN 'link_expired'
            ELSE state END";
    }

    public function history(?int $userId, int $page, ?string $reference, array $options = []): array
    {
        $page = max(1, $page);
        $filters = [];
        $params = [];
        if ($userId !== null) {
            $filters[] = 'user_id=?';
            $params[] = $userId;
        } elseif ($reference !== null) {
            $filters[] = 'reference=?';
            $params[] = $reference;
        }
        if (($options['query'] ?? '') !== '') {
            $term = '%'.strtr($options['query'], ['='=>'==', '%'=>'=%', '_'=>'=_']).'%';
            $filters[] = "(package_name LIKE ? ESCAPE '=' OR reference LIKE ? ESCAPE '=')";
            array_push($params, $term, $term);
        }
        if (($options['status'] ?? '') !== '') {
            $filters[] = $this->statusSql().'=?';
            $params[] = $options['status'];
        }
        if (($options['days'] ?? 0) > 0) {
            $filters[] = 'created_at>=?';
            $params[] = self::rangeStart($options['days']);
        }
        if ($userId === null && ($options['mode'] ?? '') !== '') {
            $filters[] = 'gateway_mode=?';
            $params[] = $options['mode'];
        }
        $where = $filters ? ' WHERE '.implode(' AND ', $filters) : '';
        $count = $this->db->prepare('SELECT COUNT(*) FROM payment_orders'.$where);
        $count->execute($params);
        $total = (int) $count->fetchColumn();
        $page = min($page, max(1, (int) ceil($total / self::PAGE_SIZE)));
        $rows = $this->db->prepare(self::HISTORY_SELECT.$where.' ORDER BY id DESC LIMIT '.self::PAGE_SIZE.' OFFSET '.(($page-1)*self::PAGE_SIZE));
        $rows->execute($params);
        $selected = $userId !== null && $reference !== null ? $this->selected($userId,$reference) : null;
        return ['items'=>array_map(fn(array $row):array=>$this->present($row,$userId===null),$rows->fetchAll()),
            'page'=>$page,'pageSize'=>self::PAGE_SIZE,'total'=>$total,'selected'=>$selected];
    }

    public function selected(int $userId, string $reference): ?array
    {
        $query = $this->db->prepare(self::HISTORY_SELECT.' WHERE user_id=? AND reference=?');
        $query->execute([$userId,$reference]);
        $row = $query->fetch();
        return $row ? $this->present($row) : null;
    }

    private static function rangeStart(int $days): string
    {
        return (new \DateTimeImmutable('today', new \DateTimeZone('UTC')))
            ->modify('-'.($days-1).' days')->format('Y-m-d H:i:s');
    }

    public function analytics(int $days, string $mode): array
    {
        $start = self::rangeStart($days);
        $window = 'gateway_mode=? AND created_at>=?';
        $parameters = [$mode, $start];
        $summary = $this->db->prepare("SELECT COUNT(*) AS orders, COUNT(CASE WHEN state='paid' THEN 1 END) AS paid,
            COUNT(DISTINCT CASE WHEN state='paid' THEN user_id END) AS buyers,
            COUNT(CASE WHEN state='paid' AND refunded_minor>0 THEN 1 END) AS refunded
            FROM payment_orders WHERE ".$window);
        $summary->execute($parameters);
        $totals = array_map('intval', $summary->fetch());

        $money = 'SUM(amount_minor) AS gross, SUM(refunded_minor) AS refunds,
            SUM(CAST(amount_minor AS SIGNED)-refunded_minor) AS net';
        $currencies = $this->db->prepare("SELECT currency, ".$money." FROM payment_orders
            WHERE state='paid' AND ".$window.' GROUP BY currency ORDER BY currency');
        $currencies->execute($parameters);

        $trend = $this->db->prepare("SELECT DATE(created_at) AS day, COUNT(*) AS paid
            FROM payment_orders WHERE state='paid' AND ".$window.' GROUP BY DATE(created_at) ORDER BY day');
        $trend->execute($parameters);
        $byDay = $trend->fetchAll(PDO::FETCH_KEY_PAIR);
        $daily = [];
        $first = new \DateTimeImmutable($start, new \DateTimeZone('UTC'));
        for ($offset = 0; $offset < $days; $offset++) {
            $day = $first->modify('+'.$offset.' days')->format('Y-m-d');
            $daily[] = ['day'=>$day, 'paid'=>(int) ($byDay[$day] ?? 0)];
        }

        $packages = $this->db->prepare("SELECT COALESCE(MAX(p.name), MAX(o.package_name)) AS name,
            o.currency, COUNT(*) AS paid, SUM(o.amount_minor) AS gross, SUM(o.refunded_minor) AS refunds,
            SUM(CAST(o.amount_minor AS SIGNED)-o.refunded_minor) AS net
            FROM payment_orders o LEFT JOIN token_packages p ON p.id=o.package_id
            WHERE o.state='paid' AND o.gateway_mode=? AND o.created_at>=?
            GROUP BY o.package_id, CASE WHEN o.package_id IS NULL THEN o.package_name END, o.currency
            ORDER BY paid DESC, name, o.currency LIMIT 12");
        $packages->execute($parameters);
        return ['totals'=>$totals, 'currencies'=>$currencies->fetchAll(), 'trend'=>$daily, 'packages'=>$packages->fetchAll()];
    }

    private function present(array $order, bool $admin = false): array
    {
        $activeLink = strtotime($order['link_expires_at'].' UTC') > time();
        $status = $order['state'];
        if ($status === 'paid' && (int)($order['refunded_minor'] ?? 0) > 0) {
            $status = (int)$order['refunded_minor'] >= (int)$order['amount_minor'] ? 'refunded' : 'partially_refunded';
        } elseif ($status === 'creating' && strtotime($order['created_at'].' UTC') <= time()-self::CREATE_TIMEOUT_SECONDS) {
            $status = 'unavailable';
        } elseif ($status === 'pending' && !$activeLink) {
            $status = 'link_expired';
        }
        $checkout = !$admin && $activeLink && $order['gateway_mode'] === HitPay::mode() && HitPay::available()
            && in_array($status, ['pending','failed'], true) ? HitPay::checkoutUrl($order['checkout_url'] ?? null,$order['gateway_mode']) : null;
        return [
            'reference'=>$order['reference'],'package'=>$order['package_name'],'amountMinor'=>(int)$order['amount_minor'],
            'currency'=>$order['currency'],'mode'=>$order['gateway_mode'],'status'=>$status,
            'checkoutUrl'=>$checkout,'createdAt'=>$order['created_at'],'paidAt'=>$order['paid_at']??null,
            'refundedMinor'=>(int)($order['refunded_minor']??0),'delivered'=>isset($order['grant_id']),
            ...($admin?['userId'=>$order['user_id'],'requestId'=>$order['gateway_request_id'],'chargeId'=>$order['gateway_charge_id']]:[]),
        ];
    }
}
