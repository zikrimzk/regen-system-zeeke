# Phase 02A · Visual QA

## Setup and evidence

The previous phase captures are in `output/regen-v2`. The new captures are in `output/regen-v2/phase-02a`. Chromium used desktop and mobile emulation with disposable MySQL, the PHP development server, fictional users/documents, and external providers disabled.

| Surface | Before and after | Browser coverage |
| --- | --- | --- |
| Landing | A static first-screen paper became an interactive published design comparison over original Kuala Lumpur artwork. | Hero controls change the example and PDF link. The initial run checked 360, 390, 768, 1024 and 1440 px and captured a long Malay phone headline. Pricing showed three fixture offers. |
| Workspace | A list of all sections and expanded wallet competed with the active document. The document now has its real title, template example and next action, with disclosure for the full outline. | Checked saved, incomplete and empty candidate states, saved-letter counts, provider-unavailable copy, real PDF rendering and focus return. Checked 360, 390, 768, 1024 and 1440 px. |
| Resume Studio | The editor previously centered its forms and launched preview separately. The wide-screen Studio places document outline, active form and saved PDF in distinct regions. The phone keeps a single form and a draft preview layer. | Opened an owned legacy URL, checked the rendered saved PDF and stale message after a write, recovered an offline edit, validated and removed an unfinished entry, switched to a permitted design and verified saved content, navigated sections and used draft preview. Checked 360, 390, 768, 1024 and 1440 px. |
| Supporting screens | Letters use a dedicated studio heading and reading space. Templates introduce visual comparison directly. Mochi leaves the writing area free and remains reachable. | Phone review reached the populated letter form, template picker and Mochi room. Saving a fictional letter updated the dashboard count. |
| Administration | The dark rail and scoped operational layout carry forward. Shared form and dialog sizing has a narrow scope. | Synthetic super and support-only accounts reached the expected modules in Chrome. The support-only account was denied Accounts from its deep link. The existing isolated HTTP suite covered guarded admin and maintenance operations. |

## Accessibility and responsiveness

The comparison links work from the keyboard and retain a normal PDF destination. The active sample is announced in a status region. Saved and draft previews have different names. The dashboard dialog restores focus, and the Studio preview opens at a named close control. The active section uses `aria-current`. Save states are announced and the save button remains stable in the footer.

The first phone review caught a copied icon-only rule that blanked the new Preview button's label. The Studio now retains the text on narrow widths. The first integrated browser run also exposed unstable focus timing around a dashboard refresh. Identical live document summaries now retain the current DOM, and the focused and integrated reruns checked return to the preview opener. The template link now opens the existing candidate’s actual design picker. The first-resume gallery remains the path for a new account.

The focused dark-mode run checked the Studio at 1440 and 390 px. It verified dashboard recovery after an intentionally blocked API request, and loaded the phone design gallery with the primary control clear of Mochi.

Still to verify manually are physical iOS and Android keyboard/panning, screen-reader announcements, high zoom and a full WCAG 2.2 review. Older section fields and provider messages still need a Bahasa Melayu pass. New editorial and navigation copy is localized.

## Performance evidence

The final integrated Chromium landing capture measured 1,048 ms LCP and approximately 0.0011 CLS on a local desktop with the fixture server and no deliberate network or CPU throttling. This is a single lab sample. There is insufficient evidence for field LCP, INP or CLS conformance. The generated public stylesheet is 64,956 bytes, within the existing 65,000-byte test budget. The two responsive skyline files are 42,388 and 142,006 bytes. The Studio avoids rendering a private saved PDF on load or while typing. Preview refresh is an explicit action.

## Reproduce

1. Start an isolated copy with the existing Store HTTP fixture or equivalent synthetic accounts. Publish at least two template designs and enough offers to exercise pricing.
2. Open home, choose a different example and follow the new PDF link. Try both account states for Create my resume. Capture EN and BM at 360, 390, 768, 1024 and 1440 px.
3. Test a new account, an incomplete document and a saved document with a letter. Check that next steps and restrictions reflect real data. Temporarily interrupt network access and check dashboard retry and editor recovery.
4. From an owned resume, open the Studio on a wide screen and load the saved preview. Save a field, check the stale message, then refresh the PDF. Inspect a phone section picker, the preview layer and action visibility with the keyboard shown.
5. Test the public/demo and app flows with reduced motion and keyboard only. Try long values, an expired session, feature restrictions, the template picker, a permitted PDF export and a writing-suggestion review with a test provider.
6. Open the admin Accounts page and menu in a narrow view. Sign in with a delegated role and attempt the same deep link. Verify maintenance and alert controls with their actual permissions.
