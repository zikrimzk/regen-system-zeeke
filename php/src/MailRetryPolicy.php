<?php
declare(strict_types=1);

namespace ReGen;

final class MailRetryPolicy
{
    /** Space transient submission failures out; spread a batch across two minutes. */
    public static function delaySeconds(int $attempt, int $messageId): int
    {
        $attempt = max(1, min(5, $attempt));
        return min(21600, 1800 * (2 ** ($attempt - 1))) + abs($messageId % 121);
    }
}
