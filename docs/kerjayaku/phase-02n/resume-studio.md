# Resume Studio

The sidebar and mobile dock open `/builder`. The editor retains all 11 implemented sections and their current entry, validation and writing-help functions. The desktop document structure and working preview can collapse independently. Both preferences are local UI settings. Smaller screens use the section dialog and an inline PDF mode.

The shared visual proof follows the current section as the candidate types. Experience, projects and activities can display incomplete draft content while leaving the existing write validation in place. The Studio still uses the same template picker and displays saved access rules. Review & export enters the existing review screen only after the active section passes save checks. The existing cover letter linkage stays intact.

`app.js`, `stepper.js`, `studio.js`, `preview.js`, the three repeatable section modules and `builder.html` implement the experience. PHP routes continue using owner-scoped `ResumeActions` and `DocumentActions`. There are no changes to schema, templates or quota records.
