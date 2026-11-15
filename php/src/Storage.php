<?php
declare(strict_types=1);

namespace ReGen;

final class Storage
{
    public static function directory(string $name): string
    {
        if (!preg_match('#^[a-z0-9_-]+(?:/[a-z0-9_-]+)*$#D', $name)) {
            throw new \InvalidArgumentException('Invalid storage directory.');
        }
        $directory = dirname(__DIR__, 2) . '/storage/' . $name;
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new \RuntimeException('Application storage is not writable.');
        }
        if (!is_writable($directory)) throw new \RuntimeException('Application storage is not writable.');
        return $directory;
    }
}
