# Overview dashboard

`/dashboard` uses the candidate’s account name and prioritises the latest accessible saved resume or letter. The card contains the document title, an actual save time in Asia/Kuala_Lumpur and a direct edit action. The document list shows existing links and saved letter count. New accounts see template selection before creation. A failed dashboard response produces a retry or sign-in path.

`dashboard.js` uses the current `/api/dashboard` response, the owned letter summaries from `/api/cover-letters` when access is available, the existing wallet response from `Api.getFeaturePrices()` and `Api.getAtsReviewState()`. It displays wallet tokens, service availability and allowance usage from those outputs. The review link goes to the actual Studio review. The card identifies saved or out-of-date review data when available. Unavailable credit data is omitted. Future application, interview and job modules have no fabricated activity.

Marketing notices remain in the existing campaign feed. The mobile order puts recent work and token context before the review panel. The library remains a document-management route with the existing preview and download controls.
