<?php
declare(strict_types=1);
namespace ReGen;

/** Shared question catalogue: the server validates the same fields the form displays. */
final class ResumeAssistance
{
    public static function catalogue(): array
    {
        $sets = [
            'summary' => ['Summary or objective', 'What kind of job do you want?', 'Tell us a little about your studies or work.', 'What are you good at?', 'Anything else you want an employer to know?'],
            'experience' => ['Work experience', 'What was your job?', 'What did you do in this job?', 'Which tools or skills did you use?', 'Did anything go well because of your work?'],
            'projects' => ['Project', 'What was your project about?', 'What did you do for the project?', 'Which tools or skills did you use?', 'What did you finish or learn?'],
            'extracurricular' => ['Activities and volunteering', 'What activity did you take part in?', 'What did you do in the activity?', 'Who did you help or work with?', 'What did you finish or learn from it?'],
            'skills' => ['Skills', 'Which skills would you like to include?', 'How have you used these skills?', 'How comfortable are you using them?', 'Any other skills you want to mention?'],
            'achievements' => ['Achievements', 'What achievement are you proud of?', 'How did you earn it?', 'Who gave the award, and when?', 'Anything else about this achievement?'],
            'certifications' => ['Certifications and licences', 'What is the certificate or licence called?', 'Have you received it, or are you still working on it?', 'Who issues it, and what are the dates?', 'What did you learn or get assessed on?'],
            'additional_research' => ['Research', 'What was your research about?', 'What did you do for the research?', 'Is it finished or still in progress?', 'Where and when did you do it?'],
            'additional_publications' => ['Publications', 'What is the title, and who are the authors?', 'Where is it published, or is it still being prepared?', 'What are the date and publication details?', 'Do you need a particular citation style?'],
            'additional_teaching' => ['Teaching', 'What did you teach, and where?', 'What did you do to help students learn?', 'Who did you teach?', 'What dates or results would you like to include?'],
            'additional_presentations' => ['Presentations', 'What was your presentation about?', 'Where and when did you present it?', 'Have you given the presentation yet?', 'What was your part in the presentation?'],
            'additional_funding' => ['Grants and funding', 'What is the grant called, and who offers it?', 'Has it been awarded, or are you still applying?', 'What is your role in the project?', 'Any dates or confirmed amount to include?'],
            'additional_affiliations' => ['Professional affiliations', 'Which organisation do you belong to?', 'What is your membership type or role?', 'Are you still a member? Include dates if you know them.', 'What have you done as a member?'],
            'additional_interests' => ['Relevant interests', 'Which interests would you like to include?', 'How do you spend time on these interests?', 'Why are they useful for this application?', 'Anything else you want to add?'],
            'additional_custom' => ['Additional information', 'What would you like this section to be about?', 'What would you like to tell an employer?', 'Any names, dates or details to include?', 'Anything else that would help us write it?'],
        ];
        // Examples explain the answer without making users learn resume-writing terms.
        $examples = [
            'summary' => ['For example: An internship in marketing, or a senior accounting role.', 'For example: I’m studying business, or I’ve worked in customer service for several years.', 'For example: Excel, explaining ideas clearly, or organising tasks.', 'For example: A project you enjoyed or the work you want to do next.'],
            'experience' => ['For example: Sales assistant at a clothing shop.', 'For example: I helped customers, updated stock records and handled payments.', 'For example: Excel, a booking system or helping customers.', 'For example: I kept stock records up to date. Numbers are optional.'],
            'projects' => ['For example: A class project to build a booking website.', 'For example: I designed the pages and tested the booking form.', 'For example: Figma, PHP, Excel or interviews.', 'For example: We finished a working demo. Say what is true for your project.'],
            'extracurricular' => ['For example: A university club or a community food drive.', 'For example: I registered participants and helped set up the event.', 'For example: Other volunteers, students or local families.', 'For example: I learned to coordinate event tasks.'],
            'skills' => ['For example: Excel, customer service or English.', 'For example: I used Excel to keep stock records during my internship.', 'For example: Beginner in Excel; comfortable speaking English.', 'List only skills you have actually used.'],
            'achievements' => ['For example: A competition prize, scholarship or award.', 'For example: I worked with classmates on a project that won a prize.', 'For example: University project competition, 2025.', 'Include a confirmed placing or result if you know it.'],
            'certifications' => ['Use the name shown on the certificate or licence.', 'For example: Completed, in progress, expected in June, or expired.', 'For example: The training provider, issue date or expiry date.', 'For example: Spreadsheet formulas and data analysis.'],
            'additional_research' => ['For example: A study of how students use online learning.', 'For example: I collected survey responses and analysed the results.', 'For example: Data collection is complete; the report is in progress.', 'For example: A university research project, 2024–2025.'],
            'additional_publications' => ['Copy the exact title and author names in their correct order.', 'For example: Published in a journal, submitted for review, or still being written.', 'Add the year, journal, pages or DOI if you know them.', 'For example: APA. You can leave this blank.'],
            'additional_teaching' => ['For example: Mathematics tutoring at a learning centre.', 'For example: I prepared practice questions and explained difficult topics.', 'For example: Secondary school students or new employees.', 'Include only dates and outcomes you know.'],
            'additional_presentations' => ['For example: A presentation about a student research project.', 'For example: A university seminar in May 2025.', 'For example: Already presented, accepted, or still proposed.', 'For example: I prepared the slides and presented the findings.'],
            'additional_funding' => ['Use the actual grant and funding organisation names.', 'For example: Awarded, application submitted, or decision pending.', 'For example: Research assistant or project applicant.', 'Include only confirmed information that you can share.'],
            'additional_affiliations' => ['Use the actual organisation name.', 'For example: Student member, associate member or committee member.', 'For example: Active member since 2024.', 'For example: I helped organise member workshops.'],
            'additional_interests' => ['For example: Photography, coding projects or community gardening.', 'For example: I volunteer at a community garden on weekends.', 'For example: A hobby related to the role you want.', 'You can leave this blank.'],
            'additional_custom' => ['For example: Mentoring, community work or a career break.', 'A few notes about what you did are enough.', 'Include only facts you want to appear in your resume.', 'You can leave this blank.'],
        ];
        $result = [];
        foreach ($sets as $key => $set) {
            $result[$key] = ['label' => array_shift($set), 'questions' => []];
            foreach ($set as $i => $label) $result[$key]['questions'][] = ['id' => 'answer' . ($i + 1), 'label' => $label, 'example' => $examples[$key][$i], 'required' => $i < 2];
        }
        return $result;
    }

    public static function cleanAnswers(string $section, mixed $raw): array
    {
        $definition = self::catalogue()[$section] ?? null;
        if ($definition === null || !is_array($raw)) throw new OpenAIServiceException('Choose a supported writing section.', 422);
        $answers = [];
        foreach ($definition['questions'] as $question) {
            $value = $raw[$question['id']] ?? '';
            if (!is_string($value) || mb_strlen($value) > 2000) throw new OpenAIServiceException('Keep each answer within 2,000 characters.', 422);
            $value = Sanitizer::cleanText($value, true, 2000);
            if ($question['required'] && mb_strlen($value) < 3) throw new OpenAIServiceException('Add a few words to each of the first two answers, then generate your draft.', 422);
            $answers[$question['label']] = $value;
        }
        if (mb_strlen(implode(' ', $answers)) < 30) throw new OpenAIServiceException('Add a little more detail about your own experience before generating.', 422);
        return $answers;
    }
}
