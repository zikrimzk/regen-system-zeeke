-- HIDE HISTORY WITHOUT REMOVING THE RECORDS THAT ENFORCE SESSION REVOCATION.
ALTER TABLE account_sessions ADD COLUMN history_hidden_at DATETIME(3) NULL;
CREATE INDEX idx_account_sessions_history ON account_sessions (user_id, history_hidden_at, last_seen_at);
