<?php
declare(strict_types=1);

namespace ReGen;

/** A definitive SMTP 5xx reply requires review rather than automatic redelivery. */
final class MailDeliveryRejected extends \RuntimeException
{
    public function __construct(public readonly int $smtpCode)
    {
        parent::__construct('The SMTP server rejected the request with code '.$smtpCode.'.');
    }
}
