-- Apply once after 014. Existing rewarded feedback remains counted toward the default limit of one.
ALTER TABLE feedback_rewards DROP PRIMARY KEY, ADD PRIMARY KEY (user_id,feedback_id);
ALTER TABLE support_tickets ADD COLUMN client_context JSON NULL;
