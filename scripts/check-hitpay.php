<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
$root = dirname(__DIR__);
require $root.'/vendor/autoload.php';
require __DIR__.'/fixtures/StoreHttpFixture.php';

use ReGen\{BonusCreditService, ConcurrentUpdate, Config, EmailVerificationService, HitPay, HitPayCheckoutException, NotificationService, PaymentOrders, TokenStore};

$checks = 0;
$check = static function (bool $ok, string $message) use (&$checks): void {
    $checks++;
    if (!$ok) throw new RuntimeException($message);
};
$fixture = new StoreHttpFixture($root);
try {
    $ids = $fixture->start();
    $dsn = 'mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$ids['database'].';charset=utf8mb4';
    $db = new PDO($dsn, Config::get('db.user'), Config::get('db.password'), [
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
    ]);
    $user = $ids['userId'];
    $other = (int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();
    $package = (int)$db->query('SELECT MIN(id) FROM token_packages')->fetchColumn();
    $db->prepare("UPDATE token_packages SET features_json='{\"pdf_download\":2}',validity_days=30 WHERE id=?")->execute([$package]);
    $orders = new PaymentOrders($db);
    $base = (new BonusCreditService($db))->balance($user)['balance'];
    $key = '2c78be0b-943b-4d92-9aca-36243b0807a6';
    $gatewayId = '2c78be0b-943b-4d92-9aca-36243b0807a7';
    $chargeId = '2c78be0b-943b-4d92-9aca-36243b0807a8';
    $input = ['packageId'=>$package,'version'=>1,'amountMinor'=>1200,'requestKey'=>$key];
    $input['version'] = (int)$db->query('SELECT version FROM token_packages WHERE id='.$package)->fetchColumn();
    $calls = 0;
    $mock = static function (array $order) use ($gatewayId, &$calls, $check): array {
        $calls++;
        $check($order['amount_minor']===1200 && $order['currency']==='MYR','The quote comes from the stored package.');
        return ['id'=>$gatewayId,'url'=>'https://checkout.sandbox.hit-pay.com/payment-request/@fixture/'.$gatewayId.'/checkout',
            'reference_number'=>$order['reference'],'amount'=>'12.00','currency'=>'MYR','status'=>'pending'];
    };
    try {
        $orders->start($user,[...$input,'amountMinor'=>1],'sandbox',$mock);
        throw new RuntimeException('The wrong quote was accepted.');
    } catch (ConcurrentUpdate) {
        $check($calls===0,'A stale price never reaches the provider.');
    }
    $order = $orders->start($user,$input,'sandbox',$mock);
    $retry = $orders->start($user,$input,'sandbox',$mock);
    $secondClick = $orders->start($user,[...$input,'requestKey'=>'2c78be0b-943b-4d92-9aca-36243b0807a9'],'sandbox',$mock);
    $check($calls===1 && $retry['reference']===$order['reference'] && $secondClick['reference']===$order['reference'],'Repeated starts reuse the open checkout.');
    $check($order['status']==='pending' && (new BonusCreditService($db))->balance($user)['balance']===$base,'Opening checkout does not deliver benefits.');
    $check($orders->history($other,1,$order['reference'])['selected']===null,'Other accounts cannot read this order.');
    $check(HitPay::checkoutUrl('https://securecheckout.sandbox.hit-pay.com.example.org/payment-request/demo','sandbox')===null,'Only the configured checkout host is accepted.');
    $check(HitPay::minor('12.001')===null && HitPay::minor('12.01')===1201,'Amounts are compared as exact cents.');

    $webhook = static function (string $object, string $event, array $payload, bool $valid = true) use ($fixture): int {
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $signature = $valid ? hash_hmac('sha256',$body,$fixture->hitpayWebhookSalt) : str_repeat('0',64);
        $curl = curl_init($fixture->base.'/api/webhooks/hitpay/sandbox');
        curl_setopt_array($curl, [
            CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,
            CURLOPT_HTTPHEADER=>['Content-Type: application/json','Hitpay-Signature: '.$signature,'Hitpay-Event-Object: '.$object,'Hitpay-Event-Type: '.$event],
        ]);
        curl_exec($curl);
        return curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
    };
    $payload = ['id'=>$gatewayId,'reference_number'=>$order['reference'],'amount'=>'12.00','currency'=>'myr','status'=>'completed',
        'payments'=>[['id'=>$chargeId,'status'=>'succeeded','amount'=>'12.00','currency'=>'myr','refunded_amount'=>'0.00']]];
    $check($webhook('payment_request','completed',$payload,false)===401,'The endpoint requires a valid raw-body signature.');
    $check($webhook('payment_request','completed',[...$payload,'currency'=>'sgd'])===409,'A different currency is rejected.');
    $check($webhook('payment_request','completed',[...$payload,'amount'=>'11.99'])===409,'A different amount is rejected.');
    $check($webhook('payment_request','completed',[...$payload,'id'=>$chargeId])===409,'The registered provider request is required.');
    $check($orders->history($user,1,$order['reference'])['selected']['status']==='pending','An invalid confirmation leaves the order pending.');
    $db->exec("UPDATE token_packages SET tokens=1,features_json='{\"pdf_download\":9}',version=version+1 WHERE id=".$package);
    $check($webhook('payment_request','completed',$payload)===200,'The matching confirmation is accepted.');
    $check($webhook('payment_request','completed',$payload)===200,'Duplicate confirmation is acknowledged.');
    $check($webhook('payment_request','failed',[...$payload,'status'=>'failed'])===200,'An older failure is acknowledged.');
    $check((new BonusCreditService($db))->balance($user)['balance']===$base+30,'The quoted tokens are delivered once.');
    $grant = $db->query('SELECT grant_id FROM payment_orders')->fetchColumn();
    $check((int)$db->query("SELECT included_uses FROM package_entitlements WHERE grant_id=".(int)$grant." AND feature_key='pdf_download'")->fetchColumn()===2,'The quoted feature allowance is delivered.');
    $check($orders->history($user,1,$order['reference'])['selected']['status']==='paid','The owner sees verified payment status.');
    $receiptKey = 'payment_receipt:'.$order['reference'];
    $receipt = $db->prepare('SELECT o.status FROM email_outbox o JOIN user_notifications n ON n.id=o.notification_id WHERE n.dedupe_key=?');
    $receipt->execute([$receiptKey]);
    $check($receipt->fetchAll(PDO::FETCH_COLUMN) === ['pending'],'The verified purchase queues one receipt despite repeated webhooks.');
    $delivered = [];
    $mailer = new EmailVerificationService('https://regen.example.test','test','sender@qa.regen.local',
        transport: static function (string $recipient, string $subject, string $message) use (&$delivered): bool {
            $delivered[] = [$recipient,$subject,$message];
            return true;
        });
    (new NotificationService($db))->work($mailer);
    $receipt->execute([$receiptKey]);
    $check($receipt->fetchColumn()==='accepted' && count($delivered)===1
        && $delivered[0][0]==='amina@qa.regen.local' && str_contains($delivered[0][2],$order['reference']),
        'The queue delivers a transactional receipt to the verified buyer without optional email opt-in.');
    $active = (new TokenStore($db))->packages(false,1,false,$user)['items'][0];
    $otherOffer = (new TokenStore($db))->packages(false,1,false,$other)['items'][0];
    $check($active['active_grant'] && $active['has_purchase'] && !$otherOffer['active_grant'] && !$otherOffer['has_purchase'],
        'Ownership and purchase indicators are specific to the buyer.');
    $refund = ['id'=>$chargeId,'payment_request_id'=>$gatewayId,'amount'=>12,'currency'=>'myr','refunded_amount'=>3.5];
    $check($webhook('charge','updated',$refund)===200 && $webhook('charge','updated',[...$refund,'refunded_amount'=>1])===200,'Refund events are accepted and may arrive out of order.');
    $last = $orders->history($user,1,$order['reference'])['selected'];
    $check($last['status']==='partially_refunded' && $last['refundedMinor']===350,'History preserves the latest cumulative refund amount.');
    $match = $orders->history($user,8,null,['query'=>'fresh start','status'=>'partially_refunded','days'=>7]);
    $noMatch = $orders->history($other,1,null,['query'=>$order['reference'],'status'=>'partially_refunded']);
    $check($match['total']===1 && $match['page']===1 && $noMatch['total']===0,
        'Search, status, date and pagination respect the account boundary.');
    $analytics = $orders->analytics(7,'sandbox');
    $check($analytics['totals']['paid']===1 && (int)$analytics['currencies'][0]['net']===850
        && (int)$analytics['packages'][0]['refunds']===350 && $orders->analytics(7,'live')['totals']['orders']===0,
        'Analytics keep sandbox separate and compute net revenue after refunds.');
    $previousLog = (string) ini_get('error_log');
    $diagnosticLog = $fixture->directory.'/checkout-diagnostic.log';
    ini_set('error_log', $diagnosticLog);
    try {
        $updatedQuote = [...$input, 'version'=>$input['version']+1, 'requestKey'=>'2c78be0b-943b-4d92-9aca-36243b0807aa'];
        $unavailable = $orders->start($user, $updatedQuote, 'sandbox', static function (): array {
            throw new HitPayCheckoutException('curl_request_failed', 7, 0);
        });
        $invalid = $orders->start($user, [...$updatedQuote, 'requestKey'=>'2c78be0b-943b-4d92-9aca-36243b0807ab'], 'sandbox',
            static fn (array $order): array => ['id'=>$gatewayId,'url'=>'https://example.com/private-fixture-link']);
        $diagnostics = (string) file_get_contents($diagnosticLog);
        $check($unavailable['status']==='unavailable' && !isset($unavailable['curl_errno'])
            && str_contains($diagnostics, $unavailable['reference'].' mode=sandbox stage=create_request reason=curl_request_failed curl_errno=7 http_status=0'),
            'An outbound failure leaves the order unavailable and writes its diagnostics only to the server log.');
        $check($invalid['status']==='unavailable'
            && str_contains($diagnostics, $invalid['reference'].' mode=sandbox stage=validate_response reason=invalid_checkout_url checkout_url_issue=unrecognized_host')
            && !str_contains($diagnostics, 'private-fixture-link') && !str_contains($diagnostics, 'example.com'),
            'An invalid checkout URL is identified without logging the provider URL.');
    } finally {
        ini_set('error_log', $previousLog);
    }
    echo "HitPay order, signature, benefit delivery and history checks passed ($checks assertions; no provider calls).\n";
    if (($argv[1]??'') === '--preview') {
        echo 'Local preview: '.$fixture->base."\n";
        fgets(STDIN);
    }
} finally {
    $fixture->close();
}
