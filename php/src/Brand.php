<?php
declare(strict_types=1);

namespace ReGen;

final class Brand
{
    public const NAME = 'Kerjaya.';

    public static function wordmark(): string
    {
        return '<span class="product-wordmark">Kerjaya<span>.</span></span>';
    }
}
