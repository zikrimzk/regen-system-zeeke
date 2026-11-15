<?php
declare(strict_types=1);
namespace ReGen;

final class HitPay
{
    public const MODES = ['sandbox', 'live'];
    public const LINK_MINUTES = 15;

    public static function mode(): string
    {
        return (string) Config::get('hitpay.mode');
    }

    public static function available(): bool
    {
        $mode = self::mode();
        return self::permitsMode($mode)
            && (string) Config::get('hitpay.api_key') !== ''
            && (string) Config::get('hitpay.'.$mode.'_salt') !== ''
            && self::returnOrigin() !== null;
    }

    public static function permitsMode(string $mode): bool
    {
        return $mode === 'live' || ($mode === 'sandbox' && Config::get('app.env') !== 'production');
    }

    private static function returnOrigin(): ?string
    {
        $origin = (string) Config::get('app.url');
        return preg_match('#^https://[a-z0-9.-]+(?::[0-9]+)?$#iD', $origin) ? $origin : null;
    }

    public static function signed(string $body, string $signature, string $secret): bool
    {
        return $secret !== '' && preg_match('/^[a-f0-9]{64}$/D', $signature) === 1
            && hash_equals(hash_hmac('sha256', $body, $secret), $signature);
    }

    public static function uuid(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $value) === 1;
    }

    public static function minor(mixed $value): ?int
    {
        if (!is_string($value) && !is_int($value) && !is_float($value)) return null;
        if (!preg_match('/^(\d{1,9})(?:\.(\d{1,2}))?$/D', (string) $value, $parts)) return null;
        return (int) $parts[1] * 100 + (int) str_pad($parts[2] ?? '', 2, '0');
    }

    public static function checkoutUrl(mixed $url, string $mode): ?string
    {
        return self::checkoutUrlIssue($url, $mode) === null ? $url : null;
    }

    public static function checkoutUrlIssue(mixed $url, string $mode): ?string
    {
        if (!is_string($url) || $url === '') return 'missing_url';
        if (strlen($url) > 1024) return 'url_too_long';
        if (preg_match('/[\x00-\x20\\\\]/', $url)) return 'invalid_characters';
        $parts = parse_url($url);
        if ($parts === false) return 'malformed_url';
        if (($parts['scheme'] ?? '') !== 'https') return 'invalid_scheme';
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) return 'invalid_authority';
        $responseHost = $parts['host'] ?? '';
        if ($mode === 'sandbox' && $responseHost === 'checkout.sandbox.hit-pay.com') {
            // This dedicated sandbox host serves the route supplied by the checkout API.
            return null;
        }
        $host = $mode === 'sandbox' ? 'securecheckout.sandbox.hit-pay.com' : 'securecheckout.hit-pay.com';
        if ($responseHost !== $host) {
            // Record recognizable HitPay hosts without logging merchant subdomains, paths, or query strings.
            if (preg_match('/^(?:(?:securecheckout|checkout|pay|api|dashboard)\.)?(?:sandbox\.)?hit-pay\.com$/iD', $responseHost)) {
                return 'unexpected_host:'.$responseHost;
            }
            return 'unrecognized_host';
        }
        return str_starts_with($parts['path'] ?? '', '/payment-request/') ? null : 'unexpected_path';
    }

    public function create(array $order): array
    {
        $base = $order['gateway_mode'] === 'sandbox' ? 'https://api.sandbox.hit-pay.com' : 'https://api.hit-pay.com';
        $amount = (int) $order['amount_minor'];
        if (!function_exists('curl_init')) {
            throw new HitPayCheckoutException('curl_unavailable');
        }
        $handle = curl_init($base.'/v1/payment-requests');
        if ($handle === false) {
            throw new HitPayCheckoutException('curl_init_failed');
        }
        $options = [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => [
                'X-BUSINESS-API-KEY: '.Config::get('hitpay.api_key'),
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
                'X-Requested-With: XMLHttpRequest',
            ],
            CURLOPT_POSTFIELDS => http_build_query([
                'amount' => sprintf('%d.%02d', intdiv($amount, 100), $amount % 100),
                'currency' => $order['currency'],
                'purpose' => $order['package_name'],
                'reference_number' => $order['reference'],
                'redirect_url' => self::returnOrigin().'/payments/result?order='.$order['reference'],
                'allow_repeated_payments' => 'false',
                'expires_after' => self::LINK_MINUTES.' mins',
                'send_sms' => 'false',
                'send_email' => 'false',
            ], '', '&', PHP_QUERY_RFC3986),
        ];
        try {
            if (!curl_setopt_array($handle, $options)) {
                throw new HitPayCheckoutException('curl_setup_failed', curl_errno($handle));
            }
            $raw = curl_exec($handle);
            $curlError = curl_errno($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        } finally {
            curl_close($handle);
        }
        if ($raw === false) {
            throw new HitPayCheckoutException('curl_request_failed', $curlError, $status);
        }
        if ($status < 200 || $status >= 300) {
            throw HitPayCheckoutException::fromHttpResponse($curlError, $status, $raw);
        }
        $response = json_decode($raw, true);
        if (!is_array($response)) {
            throw new HitPayCheckoutException('invalid_response_json', $curlError, $status);
        }
        return $response;
    }
}
