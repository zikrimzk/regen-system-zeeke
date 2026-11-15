# Writing standard and article review

30 October 2026. This review translates the supplied resume articles and quick-tips image into product behaviour. The articles are reference material, not instructions to copy every recommendation or example into an applicant's resume. Their fictional accomplishments and promotional statistics are never applicant evidence.

## What was already implemented

ReGen already had 16 Basic/Premium designs, single-column text-based A4 exports, embedded fonts, an 11 pt default body, configurable section order, optional photos, matching cover letters and review-before-apply AI suggestions. The AI already used strict section schemas, indexed edits, redacted professional context and evidence quotes for inferred skills. These foundations remain.

The gaps were mainly in writing context and review: no saved summary/objective preference, no resume job-description context, limited CV sections, a mandatory-looking summary and scoring that counted certification years as contribution metrics. The update addresses those gaps while preserving existing document choices.

## Tip-by-tip product decisions

| Source topic | Meaning and judgment | Product and AI behaviour |
| --- | --- | --- |
| Step 0: AI assistance | An editor can improve expression; it cannot supply missing personal history. | Suggestions remain optional and reviewable. Versioned prompts require natural, factual language and distinguish resume writing from first-person letters. Local response checks reject the tested unsupported claims. |
| Step 1: gather information | Collect more than will appear in the final application, then choose relevant, defensible evidence. | Section guides ask for real contributions, scope and outcomes. The model cannot treat a job advertisement, template example or previous suggestion as proof of a qualification. |
| Step 2: format | Visual style and information order are separate decisions. Career history should remain understandable. | Document settings offer experience-first, education/project-first, skills-first hybrid and academic starting orders. They keep dated work visible. New documents default to newest-first export order for work and education; existing documents keep their entry order until changed. A pure functional layout that removes job context was not adopted as the default. |
| Step 3: header | Make identity and contact details easy to find without unnecessary personal data. | Contact information stays in the document body. Added an optional portfolio/website field alongside LinkedIn. Names and contacts are checked locally for presence and plausible formats, not verified as genuine. Photo choice remains optional; no age, gender or identity-number fields were added. |
| Step 4: profile | A summary explains existing strengths; an objective connects real strengths to a next step. Neither should be generic padding. | Saved profile type changes the editor and PDF label and guides AI. Career stage is explicit. Profiles can be omitted, including clearing a previously saved profile. Short useful objectives do not need a 35-word minimum. |
| Step 5: contributions | Show an action, what was done and useful context or an evidenced result. Paid employment is not universal. | Work, project and activity entries have an optional contribution composer: action/work, method/scope and purpose/result. It joins the candidate's own words and adds nothing until Add point is selected. Guides cover tense, responsibility and supported outcomes. Review recognises projects, volunteering, research and teaching. It does not infer reasons for gaps. AI preserves indexed facts and cannot transfer another entry's results. |
| Step 6: skills | Technical skills should be specific. Interpersonal qualities need examples. Job keywords help only when truthful. | Saved job notes guide relevance. They cannot substantiate a new skill. Exact quotes for skill additions must come from the applicant's professional record. Language names and proficiency must not be invented. Existing skill grouping and duplicate cleanup remain. |
| Step 7: education | Use official names, clear completion status and relevant detail. A result is optional, and grading systems vary. | Qualification-specific guidance remains. Guides explain expected versus completed education and relevance-based ordering. The system does not automatically delete advanced qualifications or infer graduation. |
| Step 8: credentials | A completed certificate, an in-progress course and an expired licence are different claims. | The entry composer supports completed, in-progress and expired status, with issue/expected and expiry years. Prompts preserve credential and licence status. Issuing-body verification is still the applicant's responsibility. |
| Step 9: optional sections | Add material that helps the application rather than filling every category. | Added research, publications, teaching, presentations, funding, professional affiliations, interests and custom headings. Each supports editable complete entries and the existing move/collapse tools. Referees remain optional and require permission. AI may use relevant academic facts as context but cannot invent citations, authorship, funding or publication status. |
| Step 10: proofreading | Formatting, grammar and truth require different checks. | The final screen exposes every local check plus a human proofreading checklist. Local checks cover contact formats, contribution structure, duplicated bullets and supplied dates. Field guidance flags mixed bullet punctuation. The score is labelled Writing readiness; it does not certify grammar, truth, hiring chances or employer ATS parsing. |

## Resume, academic CV and cover letter

A job resume is selective: usually one or two readable pages, subject to the actual employer's instructions. An academic CV can be longer and can need discipline-specific research and publication sections. ReGen stores this application intent, supplies an academic section-order starting point and retains content over multiple pages. There is no automatic two-page truncation or font shrinking. Additional blocks support up to eight sections, with up to 50 entries of 1,200 characters each. Their order and citation wording remain under the applicant's control; free-text publication dates are not automatically sorted or validated as bibliographic records.

Cover-letter instructions ask for a short role-specific opening, one or two supported examples and a courteous close. First-person writing is appropriate in a letter. The intended body is usually 160-280 words, shorter when the evidence is limited, without padding or repeated greetings/sign-offs. The current letter's role and requirements take precedence over earlier resume target notes. Company claims must be supplied explicitly; the model must not pretend to have researched an employer. Resume facts, not job-ad requirements, substantiate applicant qualifications and numbers. Letters use the same selected design and typography; downloads use the applicant's name. Full-length letter fixtures are checked in all 16 designs.

## Advice requiring interpretation

- **Two columns versus ATS readability:** the articles disagree. We retain one reading column because Greenhouse explicitly identifies column layouts and complex containers as parsing risks. There is no claim that every two-column resume fails every ATS.
- **One page versus ten years of experience:** an exact tenure threshold is not a universal rule. Relevance, readability, application instructions and document type matter. Academic CVs are not forced into resume page limits.
- **One-inch margins and a particular font list:** these are design suggestions, not ATS certification rules. The existing 16 mm A4 margins and embedded readable families remain; spacing is checked in actual exports.
- **Numbers in every bullet:** accurate scope or an observable qualitative contribution is useful. A date or software version is not automatically impact. The revised review does not reward certification dates as accomplishments or require invented percentages.
- **Work experience for everyone:** projects, placements, volunteering and study can establish evidence. Applicants are not told to invent paid work.
- **No personal pronouns:** normally useful for resume profiles and bullets; it is not a ban on natural first-person cover letters.
- **No pictures or references:** common job-resume defaults vary by market and employer. These choices remain optional, with contextual guidance, rather than being universally blocked or rewarded.
- **No formatting in electronic CVs:** plain-text application fields have different needs from a readable PDF. Our PDF keeps simple headings and real selectable text. The employer's requested file format takes precedence.
- **Recruiter scan times, AI placement percentages and quoted success rates:** these were not adopted as product promises, score weights or factual claims. They are not evidence about an individual application.

## Typography and page fit

MIT and Princeton recommend readable 10–12 pt body text, consistent formatting and sufficient margins. MIT's toolkit explicitly cautions against shrinking text merely to squeeze in more content. These support a range and a readable default, not a universal font or guaranteed page count. The two existing embedded families remain: Inter for contemporary sans-serif designs and DejaVu Serif for traditional designs. Using one family throughout a document avoids fallback changes and unnecessary visual variation. A serif design is not inherently more or less ATS-compatible than a sans-serif design.

Settings now offers 10, 10.5, 11, 11.5 and 12 pt body sizes, with 11 pt recommended. Detail text stays at least 10 pt; section headings remain at least as large as the selected body size. The 16 mm margins are above the 0.5-inch minimum in both university guides. Balanced and comfortable spacing remain explicit choices. Resume and cover letter inherit the same family and body-size choices; no automatic shrinking, content deletion, stretched page filling or hidden two-page cutoff is applied.

Preview and final review show the page count read from the actual generated PDF. Job-resume advice suggests one or two focused pages, letters suggest one page, and academic CVs use discipline-specific length guidance. This is advice, not a pass/fail rule. Applicants should follow employer instructions, prioritise relevant evidence, remove repetition, and inspect the PDF at full size before choosing a smaller font. A longer or sparse document is not padded with invented content.

Enhancv's own font guide also recommends readable sizes and consistent typography. It was consulted as the competitor's published advice, not independent proof of ATS compatibility. Browser safety policy blocked Resume.io during this review; its current interface and features were not inspected, and no comparative performance claim is made.

## How prompts and checks work together

The exact runtime rules are exported in [AI_WRITING_PROMPTS.md](AI_WRITING_PROMPTS.md). `ResumePrompts` holds the versioned section and letter instructions. User facts and target notes remain separate input data. Target notes and writing preferences are removed from the evidence used to validate summary numbers, cover-letter numbers and skill quotes. Personal contact information, photos and referees remain outside the professional AI context.

The local review is a heuristic about clarity and completeness of relevant evidence. Optional sections are not a checklist of points to collect. Unknown dates are not silently fabricated; dated work and education can be sorted on request while unknown-date entries retain their positions. Existing custom section order, typography and saved content are retained. The writing settings are stored atomically with the other document settings, using the existing JSON resume record; this update needs no database migration. Old clients that save document settings without a writing field retain the stored writing settings.

No automated check can establish that an applicant actually held a role or earned a credential. Numeric and literal status checks also cannot catch every semantic invention. Users must compare all suggestions to their records before applying them. The existing review-before-apply and failed-request refund flow remain. The configured OpenAI model and API key were retained; no live API requests or applicant-data transmissions were used to validate this update.

## Verification and expert review

The completed PDF checks passed **42,224 assertions across 80 resume fixtures**, plus 16 standard matching letters. Professional and graduate fixtures occupy one page, senior fixtures two, and intentionally long stress fixtures five or six without truncation. A further **86 objective, CV, full-letter and font-size exports passed 18,071 assertions**. These include 10 pt and 12 pt in every design, check actual embedded size and font coverage, retain long CV content, and keep the full-length letter fixtures on one page. All 95 pages of that second collection were rendered and visually reviewed. Six optional export cases also passed (Unicode names, optional photo, both font families and optional sections).

The writing and mocked AI checks passed 41 assertions, and the PWA cache/privacy checks passed 35. Browser checks covered 320, 390, 768 and 1440 CSS px, settings, an optional empty profile, contribution composition, credential status, additional-section reordering and final PDF page counts. Browser saves used fictional API fixtures, not applicant records or a live database integration. No live model output, employer ATS parsing or hiring outcome was certified. The subsequent landing and keyboard changes are documented in [LANDING_MOBILE_UPDATE.md](LANDING_MOBILE_UPDATE.md).

`php scripts/check-writing.php` checks prompt payload separation, personal-data exclusion, byte bounds, unsupported job-ad skills and numbers, changed credential status, responsibility escalation, complete indexed responses, objective handling, volunteering, date formats, stable sorting and safe CV headings. It uses a mock transport, not the live model. PDF fixtures cover objectives, academic content beyond two pages, a career change and full-length matching letters. These checks are followed by rendered-page review and phone/desktop UI checks.

An external reviewer should assess: whether the profile adds useful evidence; whether each contribution preserves responsibility and truth; whether the selected information serves the target role; whether a CV's citations and statuses follow its discipline; whether the letter makes a specific supported connection; and whether the actual exported PDF reads naturally. A high local score is not an award or an ATS certification.

## Primary references consulted

- [Harvard Mignone Center: creating a strong resume and cover letter](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/) — concise factual writing, consistency, tailoring and proofreading.
- [Cornell Graduate School: resumes and CVs](https://gradschool.cornell.edu/career-and-professional-development/pathways-to-success/prepare-for-your-career/take-action/resumes-and-cvs/) — distinguishing a selective job resume from a fuller academic record.
- [Greenhouse: unsuccessful resume parsing](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) — actual vendor guidance on complex layouts and parsing limitations.
- [MIT: resume checklist](https://capd.mit.edu/resources/resume-checklist/) and [resume toolkit](https://capd.mit.edu/resources/career-toolkit-crafting-an-effective-resume/) — readable sizes, consistent margins, relevant evidence and editing before shrinking.
- [Princeton: basic principles of resume writing](https://careerdevelopment.princeton.edu/resume-guide/basic-principles-resume-writing) — typography, margins, information order and honest contributions.
- [OpenAI: prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) and [untrusted input guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety) — code-managed instructions, separated input data and representative evaluations.

The supplied Enhancv text and quick-tips image were used as secondary input, compared against these sources rather than copied into product claims or applicant examples.

Additional source: [Enhancv's published font guide](https://enhancv.com/blog/ats-friendly-fonts/). No marketing statistics or hiring-success promises from that source are adopted.
