<?php
declare(strict_types=1);
namespace ReGen;

final class TemplateAccessDenied extends \DomainException
{
    public function __construct(string $message,public readonly ?array $price=null)
    {
        parent::__construct($message);
    }
}
