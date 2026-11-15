<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class PaymentWebhookController
{
    public static function serve(PDO $db, string $mode): never
    {
        $body = file_get_contents('php://input', false, null, 0, 131073);
        $secret = (string) Config::get('hitpay.'.$mode.'_salt');
        if (!HitPay::permitsMode($mode) || !is_string($body) || strlen($body) > 131072
            || !HitPay::signed($body, (string) ($_SERVER['HTTP_HITPAY_SIGNATURE'] ?? ''), $secret)) {
            Http::json(['success'=>false], 401);
        }
        $payload = json_decode($body, true, 32);
        if (!is_array($payload)) Http::json(['success'=>false], 400);
        $event = ($_SERVER['HTTP_HITPAY_EVENT_OBJECT'] ?? '').'.'.($_SERVER['HTTP_HITPAY_EVENT_TYPE'] ?? '');
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        try {
            (new PaymentOrders($db))->applyEvent($mode, $event, $payload);
        } catch (\DomainException) {
            error_log('[HitPay webhook] Order or charge did not match.');
            Http::json(['success'=>false], 409);
        } catch (\Throwable $error) {
            error_log('[HitPay webhook] '.$error::class);
            Http::json(['success'=>false], 503);
        }
        Http::json(['success'=>true]);
    }
}
