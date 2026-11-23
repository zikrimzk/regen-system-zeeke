<?php
declare(strict_types=1);

namespace ReGen;

/** Published screenshots captured from the disposable candidate fixture. */
final class PublicProduct
{
    public const MEDIA = [
        'WORKSPACE' => ['workspace', 1100, 620, 'workspaceAlt', true],
        'LETTER_HERO' => ['letter-mobile', 390, 844, 'letterMobileAlt', true],
        'RESUME_DESKTOP' => ['resume-desktop', 1200, 780, 'resumeDesktopAlt', false],
        'RESUME_MOBILE' => ['resume-mobile', 390, 844, 'resumeMobileAlt', false],
        'LETTER_DESKTOP' => ['letter-desktop', 1200, 780, 'letterDesktopAlt', false],
        'LETTER_MOBILE' => ['letter-mobile', 390, 844, 'letterMobileAlt', false],
        'AUTH' => ['resume-desktop', 1200, 780, 'resumeDesktopAlt', false],
    ];

    public static function screenshots(string $root, string $file): array
    {
        $keys = match ($file) {
            'landing.html' => ['WORKSPACE', 'LETTER_HERO', 'RESUME_DESKTOP', 'RESUME_MOBILE', 'LETTER_DESKTOP', 'LETTER_MOBILE'],
            'login.html', 'register.html' => ['AUTH'],
            default => [],
        };
        $language = InterfaceText::language();
        $images = [];
        foreach ($keys as $key) {
            [$name, $width, $height, $label, $priority] = self::MEDIA[$key];
            $src = self::mediaUrl($root, "$name-$language");
            $phone = str_ends_with($name, '-mobile');
            $fullSize = $phone ? self::mediaUrl($root, "$name-2x-$language") : $src;
            $responsive = $phone ? ' srcset="'.$src.' 390w, '.$fullSize.' 780w" sizes="'
                .($key === 'LETTER_HERO' ? '(max-width:700px) 252px, 192px' : '(max-width:700px) 85vw, 296px').'"' : '';
            $loading = $priority ? ' fetchpriority="high"' : ' loading="lazy"';
            $image = "<img src=\"$src\"$responsive width=\"$width\" height=\"$height\" alt=\""
                .InterfaceText::html('commercial.'.$label)."\" decoding=\"async\"$loading>";
            $images['{{MARKETING_'.$key.'}}'] = $phone
                ? '<div class="device-shell"><div class="device-glass"><div class="device-safe" aria-hidden="true"></div>'.$image.'</div></div>'
                : $image;
            if (!$priority && $key !== 'AUTH') {
                $images['{{MARKETING_'.$key.'_LINK}}'] = '<a class="product-link studio-full-image" href="'.$fullSize.'">'
                    .InterfaceText::html('commercial.fullPreview').'</a>';
            }
            if ($key === 'WORKSPACE') {
                $images['{{MARKETING_'.$key.'}}'] = '<picture><source media="(max-width: 700px)" srcset="/img/marketing/pixel.svg">'.$images['{{MARKETING_'.$key.'}}'].'</picture>';
            }
        }
        return $images;
    }

    private static function mediaUrl(string $root, string $name): string
    {
        $path = "/img/marketing/studios/$name.webp";
        foreach ([$root.'/public', $root] as $public) {
            if (is_file($public.$path)) return $path.'?v='.substr(hash_file('sha256',$public.$path),0,12);
        }
        return $path;
    }

    public static function supportContact(): string
    {
        try {
            $email = (new AdminRepository(Database::connection()))->settings()['supportEmail'] ?? '';
        } catch (\Throwable) {
            return '';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return '';
        return '<a href="mailto:'.htmlspecialchars($email, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'">'
            .InterfaceText::html('nav.support').'</a>';
    }

    public static function promotion(array $packages): string
    {
        $fallback = InterfaceText::html('commercial.promo');
        foreach ($packages as $package) {
            $discount = (int)($package['discount_percent'] ?? 0);
            $claim = ($package['claim']['state'] ?? '') === 'available';
            $endsAt = $claim ? $package['claim']['endsAt'] : ($package['promotion_ends_at'] ?? null);
            if ((!$claim && ($discount < 1 || !empty($package['claim_enabled']))) || !$endsAt) continue;
            $end = new \DateTimeImmutable($endsAt, new \DateTimeZone('UTC'));
            if ($end->getTimestamp() <= time()) continue;
            $date = $end->setTimezone(new \DateTimeZone('Asia/Kuala_Lumpur'))->format('d/m/Y H:i');
            $summary = strtr(InterfaceText::text($claim ? 'commercial.freeOffer' : 'commercial.offer'), [
                '{package}' => (string)$package['name'], '{percent}' => (string)$discount, '{end}' => $date,
            ]);
            return '<span data-offer-until="'.$end->getTimestamp().'">'
                .htmlspecialchars($summary, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</span><span hidden data-offer-fallback>'.$fallback.'</span>';
        }
        return $fallback;
    }
}
