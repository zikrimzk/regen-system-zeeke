<?php
declare(strict_types=1);
namespace ReGen\Actions;

use ReGen\{ConcurrentUpdate, HitPay, Http, PaymentOrders, RateLimiter, SchemaReadiness, Session};

trait PaymentActions
{
    private function paymentRoutes(string $path, string $method): void
    {
        if ($path === '/api/store/checkout' && $method === 'POST') {
            if (!HitPay::available()) Http::json(['success'=>false,'message'=>'Checkout is currently unavailable.'],503);
            $userId = Session::userId();
            RateLimiter::enforce('hitpay-checkout',(string)$userId,8,60);
            if (!(new SchemaReadiness($this->db))->payments()['schemaReady']) {
                Http::json(['success'=>false,'message'=>'Checkout is currently unavailable.'],503);
            }
            $input = Http::jsonBody();
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            try {
                $gateway = new HitPay();
                $order = (new PaymentOrders($this->db))->start($userId,$input,HitPay::mode(),$gateway->create(...));
                Http::json(['success'=>true,'order'=>$order],201);
            } catch (ConcurrentUpdate $error) {
                Http::json(['success'=>false,'message'=>$error->getMessage()],409);
            } catch (\DomainException $error) {
                Http::json(['success'=>false,'message'=>$error->getMessage()],422);
            }
        }
        if ($method !== 'GET' || !in_array($path, [
            '/api/store/payments','/api/admin/store/payments','/api/admin/store/payment-analytics',
        ], true)) return;
        $orders = new PaymentOrders($this->db);
        if ($path === '/api/admin/store/payment-analytics') {
            $days = in_array($_GET['days'] ?? '', ['7','30','90'], true) ? (int) $_GET['days'] : 30;
            $mode = in_array($_GET['mode'] ?? '', HitPay::MODES, true)
                ? $_GET['mode'] : (HitPay::mode() === 'sandbox' ? 'sandbox' : 'live');
            Http::json(['success'=>true,'mode'=>$mode,...$orders->analytics($days,$mode)]);
        }
        $reference = $_GET['order'] ?? null;
        if ($reference !== null && !PaymentOrders::validReference($reference)) {
            Http::json(['success'=>false,'message'=>'Enter a valid payment reference.'],422);
        }
        $userId = $path === '/api/store/payments' ? Session::userId() : null;
        if ($userId !== null && ($_GET['view'] ?? '') === 'result') {
            Http::json(['success'=>true,'selected'=>$reference === null ? null : $orders->selected($userId,$reference)]);
        }
        $options = [
            'query'=>is_string($_GET['q'] ?? null) ? mb_substr(trim($_GET['q']),0,80) : '',
            'status'=>in_array($_GET['status'] ?? '', [
                'creating','pending','failed','unavailable','paid','refunded','partially_refunded','link_expired',
            ], true) ? $_GET['status'] : '',
            'days'=>in_array($_GET['days'] ?? '', ['7','30','90'], true) ? (int) $_GET['days'] : 0,
            'mode'=>in_array($_GET['mode'] ?? '', HitPay::MODES, true) ? $_GET['mode'] : '',
        ];
        $page = is_string($_GET['page'] ?? null) ? (int) $_GET['page'] : 1;
        Http::json(['success'=>true,...$orders->history($userId,$page,$reference,$options)]);
    }
}
