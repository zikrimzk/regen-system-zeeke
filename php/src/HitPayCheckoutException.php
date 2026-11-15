<?php
declare(strict_types=1);
namespace ReGen;

/** Carries only safe, structured checkout diagnostics. */
final class HitPayCheckoutException extends \RuntimeException
{
    private const VALIDATION_FIELDS = [
        'amount', 'currency', 'payment_methods', 'purpose', 'reference_number', 'redirect_url',
        'allow_repeated_payments', 'expires_after', 'send_sms', 'send_email', 'webhook', 'email', 'name', 'phone',
    ];

    public function __construct(
        public readonly string $reason,
        public readonly ?int $curlError = null,
        public readonly ?int $httpStatus = null,
        public readonly array $validationFields = [],
    ) {
        parent::__construct('HitPay checkout unavailable.');
    }

    public static function fromHttpResponse(int $curlError, int $status, string $body): self
    {
        $fields = [];
        if ($status === 422 && strlen($body) <= 16384) {
            $response = json_decode($body, true, 16);
            if (is_array($response['errors'] ?? null)) {
                foreach (array_keys($response['errors']) as $key) {
                    if (!is_string($key)) continue;
                    if (preg_match('/^payment_methods\.\d+$/D', $key)) $key = 'payment_methods';
                    if (in_array($key, self::VALIDATION_FIELDS, true)) $fields[$key] = true;
                }
            }
        }
        return new self('http_response_rejected', $curlError, $status, array_keys($fields));
    }
}
