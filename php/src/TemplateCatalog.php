<?php

declare(strict_types=1);

namespace ReGen;



final class TemplateCatalog

{

    public static function all(): array

    {

        $all = [

            ['id'=>'classic','name'=>'Classic','tier'=>'basic','fontKey'=>'garamond','description'=>'A traditional centred masthead, fine rules and elegant book typography.','recommendedFor'=>'General and corporate applications','accent'=>'#283342','font'=>'EB Garamond','style'=>'classic','photo'=>false],

            ['id'=>'modern','name'=>'Modern','tier'=>'basic','fontKey'=>'sans','description'=>'A clean left masthead, open headings and a crisp typographic hierarchy.','recommendedFor'=>'Business and technology','accent'=>'#24516a','font'=>'Inter','style'=>'modern','photo'=>false],

            ['id'=>'minimal','name'=>'Minimal','tier'=>'basic','fontKey'=>'lato','description'=>'Quiet, carefully spaced typography without decorative lines.','recommendedFor'=>'Concise, focused applications','accent'=>'#333333','font'=>'Lato','style'=>'minimal','photo'=>false],

            ['id'=>'heritage','name'=>'Heritage','tier'=>'basic','fontKey'=>'serif','description'=>'A formal serif document with centred section labels and fine top rules.','recommendedFor'=>'Established professions','accent'=>'#334b40','font'=>'DejaVu Serif','style'=>'heritage','photo'=>false],

            ['id'=>'essential','name'=>'Essential','tier'=>'basic','fontKey'=>'source','description'=>'A balanced portrait masthead with clean rules and an open reading column.','recommendedFor'=>'Applications that request a photo','accent'=>'#303943','font'=>'Source Sans 3','style'=>'essential','photo'=>true],

            ['id'=>'graduate','name'=>'Graduate','tier'=>'basic','fontKey'=>'sans','description'=>'An academic masthead with education and projects brought forward.','recommendedFor'=>'Students and early careers','accent'=>'#255b58','font'=>'Inter','style'=>'graduate','photo'=>false],

            ['id'=>'executive','name'=>'Executive','tier'=>'premium','fontKey'=>'baskerville','description'=>'An authoritative serif masthead, generous hierarchy and discreet rules.','recommendedFor'=>'Leadership and management','accent'=>'#283b4b','font'=>'Libre Baskerville','style'=>'executive','photo'=>false],

            ['id'=>'editorial','name'=>'Editorial','tier'=>'premium','fontKey'=>'garamond','description'=>'A publication-inspired masthead and elegant, open section headings.','recommendedFor'=>'Writing and communications','accent'=>'#663d35','font'=>'EB Garamond','style'=>'editorial','photo'=>false],

            ['id'=>'precision','name'=>'Precision','tier'=>'premium','fontKey'=>'source','description'=>'A disciplined uppercase masthead and fine section rules.','recommendedFor'=>'Technical and analytical roles','accent'=>'#344754','font'=>'Source Sans 3','style'=>'precision','photo'=>false],

            ['id'=>'horizon','name'=>'Horizon','tier'=>'premium','fontKey'=>'source','description'=>'An airy portrait introduction with understated headings and fine dividers.','recommendedFor'=>'Client-facing photo applications','accent'=>'#216467','font'=>'Source Sans 3','style'=>'horizon','photo'=>true],

            ['id'=>'signature','name'=>'Signature','tier'=>'premium','fontKey'=>'garamond','description'=>'A distinctive serif nameplate, double rule and restrained small capitals.','recommendedFor'=>'Senior individual contributors','accent'=>'#63394c','font'=>'EB Garamond','style'=>'signature','photo'=>false],

            ['id'=>'atlas','name'=>'Atlas','tier'=>'premium','fontKey'=>'lato','description'=>'A structured portrait masthead with a strong top rule and clear section markers.','recommendedFor'=>'Operations photo applications','accent'=>'#25576b','font'=>'Lato','style'=>'atlas','photo'=>true],

            ['id'=>'meridian','name'=>'Meridian','tier'=>'premium','fontKey'=>'baskerville','description'=>'Balanced book typography with centred headings and a fine masthead rule.','recommendedFor'=>'Finance and advisory','accent'=>'#4b453b','font'=>'Libre Baskerville','style'=>'meridian','photo'=>false],

            ['id'=>'keystone','name'=>'Keystone','tier'=>'premium','fontKey'=>'source','description'=>'Strong role titles, precise rules and generous room for technical detail.','recommendedFor'=>'Engineering and specialist roles','accent'=>'#31534d','font'=>'Source Sans 3','style'=>'keystone','photo'=>false],

            ['id'=>'counsel','name'=>'Counsel','tier'=>'premium','fontKey'=>'serif','description'=>'A formal centred masthead with finely framed section headings.','recommendedFor'=>'Legal and public-sector applications','accent'=>'#353b4b','font'=>'DejaVu Serif','style'=>'counsel','photo'=>false],

            ['id'=>'impact','name'=>'Impact','tier'=>'premium','fontKey'=>'sans','description'=>'A confident portrait masthead and bold section rules with clear role hierarchy.','recommendedFor'=>'Commercial photo applications','accent'=>'#4b434d','font'=>'Inter','style'=>'impact','photo'=>true],

        ];

        foreach ($all as &$template) $template['recommendedOrder'] = Sanitizer::sectionOrder(self::recommendedOrder($template['id']));

        unset($template);

        return $all;

    }

    private static function recommendedOrder(string $id): array

    {

        return match ($id) {

            'graduate' => ['summary','education','projects','experience','skills'],

            'heritage' => ['summary','education','experience','skills'],

            'precision','keystone' => ['summary','skills','experience','projects','education'],

            'executive','impact' => ['summary','achievements','experience','skills','education'],

            'editorial' => ['summary','projects','experience','education','skills'],

            default => ['summary','experience','education','skills','certifications'],

        };

    }

    public static function sample(string $id): array

    {

        return [

            'templateId'=>$id,

            'sectionOrder'=>self::get($id)['recommendedOrder'],

            'personal'=>['fullName'=>'Zamir Zaini', 'jobTitle'=>'Operations Specialist', 'email'=>'zamir@example.com', 'phone'=>'+60 12 345 6789', 'address'=>'Melaka, Malaysia', 'photoBase64'=>self::get($id)['photo'] ? self::samplePortrait() : ''],

            'summary'=>'Operations specialist with experience coordinating projects, improving team processes and turning business data into practical decisions. Brings clear communication and a structured approach to every project.',

            'experience'=>[

                ['jobTitle'=>'Operations Specialist', 'company'=>'Syarikat Contoh', 'startDate'=>'2022-06', 'endDate'=>'Present', 'bullets'=>['Coordinated cross-functional projects and maintained delivery schedules for a team of 12.', 'Created weekly reporting dashboards to help managers identify process bottlenecks.', 'Documented operating procedures and supported onboarding for new colleagues.']],

                ['jobTitle'=>'Project Coordinator', 'company'=>'Fieldwork Studio', 'startDate'=>'2020-07', 'endDate'=>'2022-05', 'bullets'=>['Managed project documentation and communicated progress to internal stakeholders.', 'Organized client meetings and tracked actions through to completion.']],

            ],

            'education'=>[['degree'=>'Bachelor of Business Administration', 'institution'=>'Universiti Malaya', 'startDate'=>'2016-09', 'endDate'=>'2020-06']],

            'skills'=>['technical'=>'Data analysis, project coordination, process documentation', 'software'=>'Microsoft Excel, Power BI, Asana', 'interpersonal'=>'Communication, problem solving, teamwork'],

            'certifications'=>['Project Management Fundamentals, 2023'],

        ];

    }



    private static function samplePortrait(): string
    {
        $root = dirname(__DIR__, 2);
        $file = is_file($root.'/public/img/sample-portrait.png') ? $root.'/public/img/sample-portrait.png' : $root.'/img/sample-portrait.png';
        return is_file($file) ? 'data:image/png;base64,'.base64_encode((string)file_get_contents($file)) : '';
    }

    public static function valid(mixed $id): bool

    {

        return is_string($id) && in_array($id, array_column(self::all(), 'id'), true);

    }

    public static function sampleLetter(): array

    {

        return [

            'recipient' => 'Hiring Manager', 'company' => 'Syarikat Contoh', 'role' => 'Operations Specialist',

            'body' => "I am applying for the Operations Specialist opportunity at Syarikat Contoh.\n\nMy experience coordinating projects, preparing reports and documenting team processes has given me a practical understanding of reliable operations. I would bring a structured and collaborative approach to your team.\n\nI would welcome the opportunity to discuss how my experience could contribute to your organisation. Thank you for considering my application.",

        ];

    }

    public static function get(mixed $id): array

    {

        foreach (self::all() as $template) if ($template['id'] === $id) return $template;

        return self::all()[0];

    }

    public static function css(mixed $id, mixed $preferences = []): string

    {

        return DocumentStyle::base($id, $preferences);

    }



    public static function fontStack(string $font): string

    {

        return DocumentFonts::stack($font);

    }



    /** Losslessly compressed browser faces preserve the original PDF typography. */

    public static function browserHtml(string $html): string

    {

        foreach (array_merge(array_column(DocumentFonts::all(), 'regular'), array_column(DocumentFonts::all(), 'bold')) as $face) {

            $html = str_replace('/fonts/' . $face . '.ttf") format("truetype")', '/fonts/' . $face . '.woff2") format("woff2")', $html);

        }

        return (string) preg_replace_callback('~@font-face\{[^}]+\}~', static fn(array $match): string => rtrim($match[0], '}') . ';font-display:swap}', $html);

    }



    /** Only validated, finite options are interpolated into document CSS. */

    public static function appearanceCss(mixed $id, mixed $preferences): string

    {

        return DocumentStyle::appearance($id, $preferences);

    }

}

