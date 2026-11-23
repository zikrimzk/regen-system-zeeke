<?php
declare(strict_types=1);

namespace ReGen;

final class Brand
{
    public const NAME = 'Kerjayaku.';
    public const REGISTRATION = 'AS0482253-X';
    public const COMPANY = 'Zeeke Software Solution';

    public static function wordmark(): string
    {
        return '<span class="product-wordmark">Kerjayaku<span>.</span></span>';
    }
}
