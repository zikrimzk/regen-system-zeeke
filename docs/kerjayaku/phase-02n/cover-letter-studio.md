# Cover Letter Studio

An existing letter opens directly into its writing area. The company, role and date stay together and can collapse after the record is saved. Recipient and job details remain separate. The letter body keeps editable plain text and existing word-count and AI suggestion controls. Desktop users can write next to a working proof. Mobile users can switch to the proof and return to the same editor.

`cover-letters.js` continues to call `Api.listCoverLetters()`, `getCoverLetter()`, `saveCoverLetter()` and the existing PDF and suggestion routes. New letters use explicit creation. Subsequent valid changes autosave. An open draft is preserved when switching letters. Network or session problems leave the current text in memory and the existing same-account recovery flow resumes saving.

The shared Appearance Inspector saves compatible letter settings back to the linked resume. Changing appearance therefore affects both documents, as the renderer already specifies. The UI explains the linkage. Independent letter templates and selected-paragraph refinement would require separate server capabilities. The current draft suggestion and Mochi can be used where enabled.
