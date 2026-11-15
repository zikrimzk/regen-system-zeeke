# Phase 00 · Architecture blueprint

## Phase 01 implementation

`Routes` owns current page and maintenance metadata. `AdminRoutes` makes administrator access decisions explicit by route and method while `AdminAccess` continues reading the same stored grants. `Application` shares candidate page/API verification and uses current administrator status for the shell and APIs. `MaintenanceController` handles response and return routing while `MaintenanceService` owns schedules, persistence and audit. `ReadinessController` and `SchemaReadiness` expose read-only schema checks and `PaymentWebhookController` delegates signed callbacks straight to `PaymentOrders`. `AccountRepository` owns the existing document export queries. Existing `Config`, `FeaturePolicy`, `FeaturePricing` and `HitPay` remain responsible for their settings, providers and policies.

This is one increment of the blueprint below. [Phase 01 completion report](06-phase-01-foundation.md)

Keep the PHP 8.3, PDO MySQL/MariaDB, Apache/DirectAdmin and native browser stack. Server-rendered PHP/HTML with progressive browser modules remains the normal entry point. `Application.php` currently holds route ordering and cross-feature setup while traits span HTTP, policy and application work. Extract one route family at a time, preserving responses, cookies, document rendering and operational integrations. The [route inventory](01-route-map.md) is the compatibility contract.

## Proposed layout

```text
public/
  index.php                 Front controller
  router.php, .htaccess     Local and hosting entry rules
  js/, css/, lib/            Versioned UI behavior, styles and existing libraries
php/
  bootstrap.php             Configuration, services and request lifecycle
  config/                   Typed app, route, entitlement and integration settings
  routes/                   Public, auth, app, admin, API v1, legacy and webhooks
  src/
    Http/                   Request, response, middleware and request validation
    Identity/               Accounts, credentials, roles, sessions and device history
    Documents/              Resume, cover letter, design access, rendering and recovery hooks
    CareerProfile/          Candidate facts and evidence confirmation
    Tailoring/              JD analysis, suggested edits and approved variants
    Jobs/                   Provenance, saved jobs and applications
    Coaching/               Mochi and optional interview practice
    Commerce/               Packages, tokens, entitlements, orders and future subscriptions
    Communications/         Support, campaigns, notifications and feedback
    Operations/             Maintenance, audit, security, metrics and admin settings
  views/                    Shared shell and feature pages
database/
  schema.sql, migrations/   Fresh install and additive upgrades
scripts/                    Existing checks and bounded cron entry points
```

Folders describe responsibility. Keep classes where they are until their feature moves. Preserve `ReGen\` PSR-4 and release autoloading. Introduce controllers and services only where they own real behavior. A feature that has a focused existing service can route directly through a thin controller to it.

## Request lifecycle and data boundaries

1. Route match yields a stable name, methods, access class, explicit admin capability, maintenance policy and feature/entitlement metadata. Static assets and provider callbacks retain their existing entry contracts. Status endpoints can handle connection failures at the bootstrap boundary.
2. Middleware applies request limits, origin/CSRF, session validity and scoped policy. For candidate application routes, maintenance is deny-by-default with one explicit exception list for public status/recovery, admin and signed callbacks. Separate safe public bootstrap dependencies from candidate access. Preserve graceful polling recovery. For admin API registration, require an explicit capability or an explicitly named self-service policy. Send owner/capability context through to the use case.
3. Validate route IDs, version keys, payload schema, normalized text and meaningful inputs at the boundary. Controller translates request and service results to HTML, redirect, JSON, PDF stream or a documented status. Error responses identify a safe request reference. Stale documents or prices give a recoverable conflict response.
4. Services enforce resource ownership, domain policies, limits and idempotency. Repositories bind ownership and lock predicates in SQL and expose paginated reads. DB unique constraints and transactions protect operations that create/charge/credit multiple records. Lock order is documented for order, entitlement and wallet workflows. Record related domain events in the same transaction, deliver afterward via the existing outbox mechanism. External I/O and PDF render occur outside avoidable PHP session and row locks.
5. Configure brand, `en-MY`/`ms-MY`, timezone, routes, plan entitlements, provider/model/prompt versions, job adapters, notification rules, maintenance and checkout separately from secrets. Reuse `Config`, `app_settings`, `feature_controls` and `operations_settings` and validate types, versions and defaults at their write/read boundaries. Keep environment secrets in `.env` or the approved secret store. Preserve the existing protected SMTP override until a reviewed migration. Keep provider settings optional and report readiness without values.

| Domain | Current ownership to keep or extract | Proposed boundary and output |
| --- | --- | --- |
| Identity and access | `Session`, `UserRepository`, `AccountRepository`, `AdminRepository`, `AdminAccess`, `AuthActions`, `ProfileActions`, `EmailVerificationService` and `PasswordResetService` | Controllers for password/Google/session/profile, services for sign-in and account actions. Central policy checks distinct principals, revocation, expiry, capability and reauth. No broad support access to candidate documents. Admin can inspect operational metadata separately from permissioned document export and restore. |
| Documents and designs | `ResumeRepository`, `CoverLetterRepository`, `Sanitizer`, `DocumentWriteGuard`, `RecoveryService`, `TemplateCatalog`, `TemplateAccess`, `TemplateManagement`, Dompdf/PDF.js | Candidate-owned writes preserve old IDs and JSON behavior. Exports share one rendering pipeline. Versioned paid export reserves a benefit once, returns a safe retry/reference state, and exposes bounded private artifact reads. Add explicit policy before any private admin view. Keep current “one primary” selector until reviewed expansion. |
| Candidate facts and tailoring | Current account contact and resume sections plus `ResumePrompts`, `ResumeWriting`, `ResumeAssistance`, `ResumeReview` and `AtsService` | `CareerProfile` is authoritative only after user confirmation. Read-only import proposal carries source ID and path. `JdAnalysis` treats JD text as untrusted input. `TailoredResumeVersion` stores an approved snapshot plus source/decision references. Suggestions show facts, proposed edits and exclusions. Human approval is a write boundary. |
| AI and coaching | `OpenAIService`, `AiActions`, `AiQuotaService`, `MochiCoach`, `MochiPolicy`, `MochiProfile` | Keep one provider transport and injected mocks. Version prompt sets and give each operation a typed contract. Record operation, entitlement/reservation, duration, model/prompt version and outcome without prompt text. Preserve apply/reject UI, provider retries, reversible quota settlement and local Mochi play. Interview practice owns its sessions, separate from optional coach preferences. |
| Commerce | `TokenStore`, `FeaturePricing`, `BonusCreditService`, `PackageClaims`, `PackageAccess`, `AccountPackages`, `PaymentOrders`, `HitPay` | Separate quote and entitlement evaluation from settlement. Keep cash and currency in order/payment records, saved tokens in the existing wallet/ledger and base allowance in usage accounting. Future subscription updates produce entitlements without changing old grant/ledger semantics. Worker reconciliation records verified provider facts and discrepancies with approved staff actions. |
| Support, communications and jobs | `SupportRepository`, `SupportAttachments`, `CampaignService`, `NotificationService`, `AdminAlertService`, `FeedbackRepository`, `RealtimeEvents`, `ManagedRealtime` | Channel delivery only wakes the scoped inbox/poll APIs. Durable state remains storage-backed. Jobs are a separate domain with permissioned adapter inputs, provenance and freshness. Candidate applications are self-tracked and may link to a saved job and approved document version. No implicit submission. |
| Operations and admin | `MaintenanceService`, `OperationsMonitor`, `AuditLogger`, `RequestAudit`, `AdminReportRepository`, `RuntimeMailSettings`, existing cron | Admin modules reuse domain services through explicit action-level policies. Audit private reads, role, entitlement, maintenance and export changes with actor, purpose, target and outcome. Keep operational events free of raw applicant content. Progress from aggregations to measured query/index optimization, reusing request-scoped caches and bounded jobs. |

## Change classification

| Class | Proposed changes | Impact on existing data |
| --- | --- | --- |
| KEEP | PHP/Composer, PDO/SQL, DirectAdmin/ZIP, separate identities, Google/reCAPTCHA/SMTP interfaces, current primary, all 16 designs, resume and cover-letter renderers, Assist/Refine/writing review, Mochi, user and admin functions, grants, wallet/ledger, HitPay callback paths, realtime outboxes and polling fallback. | Current IDs, template IDs and design output, document text, private assets, sessions, grants, ledger and receipts are retained. |
| REFACTOR | Route metadata and aliases, controllers for protected route families, explicit admin actions, typed policy/config, shared styles and bilingual strings, existing service boundaries, audit/privacy controls, health and paginated queries. | No bulk transformation. Keep serialized and user-visible behavior and exports stable. Change role capabilities using a reviewed mapping with denial/allowance parity checks. |
| REPLACE | The maintenance page allowlist with access-class policy, one-page admin navigation state with server-addressable modules, shadowed checkout stub with one registered handler, paid GET client workflow with idempotent POST plus GET artifact, stale docs and mixed route literals with the route registry. | Old URLs remain aliases during adoption. Terminal and maintenance states preserve open drafts and fulfillment. A priced GET deprecation requires specific client and concurrency evidence. |
| ADD | Structured career profile/evidence, JD analysis and approved resume versions, saved jobs, tracked applications, interview sessions, opt-in recurring subscriptions, minimal AI usage events and payment reconciliation/health assertions. | Additive tables or metadata only after phase sign-off. No assumed fact import, inferred eligibility, synthetic token credits, retroactive subscription conversion, raw prompt logging or automatic candidate submission. |

Near-term design calls are to keep PHP server ownership of application routing, stage existing module extraction before storage expansion, and keep interview/jobs/subscription surfaces gated. The proposed entity boundaries and storage/rollback impacts are in the [data plan](04-data-migration-plan.md). Review phase and provider dependencies before implementation. [Phase checklist](05-phase-checklist.md)
