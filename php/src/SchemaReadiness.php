<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

/** Read-only schema postconditions for migrations 002–027. */
final class SchemaReadiness
{
    private const CORE = [
        'users' => 'email_verified_at account_status ai_token_limit',
        'user_identities' => 'provider provider_subject user_id',
        'admins' => 'role status must_change_password is_bootstrap',
        'account_sessions' => 'session_hash revoked_at history_hidden_at',
        'ai_usage_reservations' => 'bonus_cost operation',
        'cover_letters' => 'user_id resume_id recipient_address letter_date',
        'resumes' => 'user_id resume_data',
        'support_tickets' => 'client_context',
        'notification_preferences' => 'consent_updated_at',
        'user_notifications' => 'removed_at',
        'admin_notifications' => 'removed_at',
        'maintenance_controls' => 'id mode title message starts_at ends_at estimated_at version',
        'token_packages' => 'claim_enabled template_tiers card_layout coin_color offer_headline offer_cta',
        'feature_prices' => 'mode token_cost version',
        'package_grants' => 'expires_at revoked_at credited_tokens reversed_tokens version',
        'package_entitlements' => 'included_uses template_tiers enabled',
        'mochi_profiles' => 'user_id preferences',
        'app_rate_limits' => '', 'app_settings' => '', 'audit_logs' => '', 'email_delivery_logs' => '',
        'email_verification_tokens' => '', 'ai_usage_windows' => '', 'admin_permissions' => '',
        'feature_controls' => '', 'operations_settings' => '', 'support_messages' => '', 'support_attachments' => '',
        'email_outbox' => '', 'notification_campaigns' => '', 'recovery_snapshots' => '', 'password_reset_tokens' => '',
        'document_generations' => '', 'landing_daily' => '', 'landing_visitors' => '', 'security_blocks' => '',
        'ai_bonus_wallets' => '', 'ai_bonus_ledger' => '', 'user_feedback' => '', 'feedback_rewards' => '',
        'feedback_reviews' => '', 'admin_access_assignments' => '', 'admin_notification_preferences' => '',
        'security_incidents' => '', 'template_controls' => '', 'template_selection_events' => '',
        'campaigns' => '', 'campaign_claims' => '', 'campaign_receipts' => '', 'realtime_events' => '',
        'realtime_outbox' => '', 'realtime_delivery_state' => '', 'token_access_purchases' => '',
        'user_feature_entitlements' => '', 'feature_use_credits' => '', 'package_use_reservations' => '',
        'package_template_unlocks' => '', 'user_template_library' => '', 'package_grant_operations' => '',
        'ai_token_activity' => '', 'package_claims' => '',
    ];

    private const PAYMENT = [
        'payment_orders' => 'id reference user_id package_id package_version package_name benefits_json amount_minor currency gateway_mode request_key state gateway_request_id gateway_charge_id checkout_url link_expires_at grant_id refunded_minor paid_at created_at',
        'token_packages' => 'id version price_minor currency active tokens bonus_tokens features_json validity_days template_tiers',
        'package_grants' => 'id user_id package_id request_key credited_tokens',
        'package_entitlements' => 'grant_id feature_key included_uses template_tiers',
        'ai_bonus_wallets' => 'user_id balance',
        'ai_bonus_ledger' => 'user_id request_key',
        'user_notifications' => 'user_id category dedupe_key',
        'email_outbox' => 'user_id notification_id',
    ];

    private const ORDER_KEYS = [
        ['reference'], ['user_id', 'request_key'], ['gateway_mode', 'gateway_request_id'],
        ['gateway_mode', 'gateway_charge_id'],
    ];

    private ?array $columns = null;

    public function __construct(private readonly PDO $db) {}

    public function coreMissing(): array
    {
        $required = self::CORE;
        if (Config::get('session.driver', 'files') === 'database') {
            $required['app_sessions'] = 'sid session_data expires_at';
        }
        $missing = $this->missing($required);
        if (isset($this->columns['maintenance_controls']['id'])
            && !$this->db->query('SELECT 1 FROM maintenance_controls WHERE id=1')->fetchColumn()) {
            $missing[] = 'maintenance_controls row 1';
        }
        return $missing;
    }

    public function payments(): array
    {
        $missing = $this->missing(self::PAYMENT);
        if (isset($this->columns['payment_orders'])) {
            $rows = $this->db->query("SELECT INDEX_NAME, COLUMN_NAME, SUB_PART FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_orders' AND NON_UNIQUE=0 ORDER BY INDEX_NAME, SEQ_IN_INDEX");
            $indexes = [];
            foreach ($rows as $row) {
                $indexes[$row['INDEX_NAME']][] = $row['SUB_PART'] === null ? $row['COLUMN_NAME'] : null;
            }
            foreach (self::ORDER_KEYS as $key) {
                if (!in_array($key, $indexes, true)) $missing[] = 'payment_orders unique (' . implode(', ', $key) . ')';
            }
        }
        $mode = HitPay::mode();
        $configured = HitPay::available();
        return [
            'schemaReady' => $missing === [], 'missing' => $missing, 'configured' => $configured,
            'mode' => in_array($mode, HitPay::MODES, true) ? $mode : 'disabled',
            'providerVerified' => false,
        ];
    }

    private function missing(array $required): array
    {
        if ($this->columns === null) {
            $this->columns = [];
            foreach ($this->db->query('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()') as $row) {
                $this->columns[$row['TABLE_NAME']][$row['COLUMN_NAME']] = true;
            }
        }
        $missing = [];
        foreach ($required as $table => $fields) {
            if (!isset($this->columns[$table])) {
                $missing[] = $table;
                continue;
            }
            if ($fields === '') continue;
            foreach (explode(' ', $fields) as $field) {
                if (!isset($this->columns[$table][$field])) $missing[] = $table . '.' . $field;
            }
        }
        return $missing;
    }
}
