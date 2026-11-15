# Email on DirectAdmin

SMTP can now be configured in **Administration → Email → Test Email → Configure email** with password confirmation and encrypted protected storage. Saved portal settings override the `.env` mail values. See [the refinement guide](ADMIN_REFINEMENT.md) for backup and consent requirements. The `.env` instructions below remain useful for initial hosting setup.

Broadcasts, purchase receipts, and welcome emails use the notification worker cron. Broadcast email requires recipient opt-in, checked again at delivery. A signed HitPay confirmation queues a receipt to the buyer's verified ReGen email. Password sign-ups get a welcome line in the verification email immediately and a separate welcome email after verification. New Google accounts queue the welcome email on creation. Receipts and welcome emails are account messages and do not require optional alert consent.

Permanent SMTP rejections stop automatically. Temporary failures retry with increasing delays starting at 30 minutes, jitter and a five-attempt ceiling. A lost final acknowledgement is held as uncertain for administrator review to avoid a duplicate. SMTP acceptance is not confirmation of inbox delivery. These distinctions follow [SMTP retry and timeout semantics](https://www.rfc-editor.org/rfc/rfc5321.html). Requested verification and reset messages retain their direct delivery path.

ReGen now accepts the familiar Laravel-style `MAIL_*` settings. You only need a working mailbox and File Manager access. You do not need SSH, Composer, a Google app password or an email API.

## 1. Get your mailbox details

In DirectAdmin, select the domain that owns the email address. Open **E-mail Manager → E-mail Accounts**. Create a mailbox such as `noreply@your-domain.com`, or use an existing one. Use its mail-client configuration / Outlook configuration option if your host exposes it.

Copy the **outgoing SMTP server** and its security/port settings. The host may be `mail.your-domain.com` or the hosting server's hostname. Use the exact hostname supplied by your host, because its TLS certificate must match. Do not copy the IMAP/POP incoming server port.

The username is the **full email address**. The password is the **mailbox password**, not your DirectAdmin login or database password. If you do not know the mailbox password, create a dedicated new mailbox or reset that mailbox's password yourself. A reset also affects email clients using that mailbox.

If your limited panel does not show email accounts, ask the hosting provider to create a mailbox and supply its SMTP hostname, port, security type and credentials. The website's domain does not have to be the same as the mailbox's domain.

## 2. Edit one file

Open **File Manager → your website's `public_html` → `.env` → Edit**. Enable hidden files if needed. Change the existing email section, rather than adding duplicate keys. For a host that specifies port **465 / SSL**, use:

```dotenv
MAIL_MAILER=smtp
MAIL_HOST=mail.your-domain.com
MAIL_PORT=465
MAIL_USERNAME=noreply@your-domain.com
MAIL_PASSWORD="your actual mailbox password"
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="ReGen"
```

Use the same actual mailbox for `MAIL_USERNAME` and `MAIL_FROM_ADDRESS`, unless the provider explicitly permits another sender. These are examples: replace the domain, mailbox and password. Keep your existing application/database settings. `APP_URL` must be the website's exact HTTPS address, because verification links use it.

If the provider specifies **587 / STARTTLS**, change just:

```dotenv
MAIL_PORT=587
MAIL_ENCRYPTION=tls
```

Keep password values quoted. In a double-quoted password, escape a literal `"` as `\"` and a literal backslash as `\\`. You can instead wrap the whole password in single quotes if it contains no single quote. `#`, spaces, `$` and `=` are preserved inside quotes. ReGen reads literal values; do not use Laravel `${APP_NAME}` substitutions. Set `MAIL_FROM_NAME="ReGen"` directly.

Save. ReGen reads `.env` on each request; there is no `artisan config:clear` command to run. Existing `MAIL_TRANSPORT`, `MAIL_FROM_EMAIL` and `SMTP_*` keys still work. When both formats exist, the new corresponding `MAIL_*` key wins, even if empty. Prefer one email section using the new names.

Optional settings can be omitted: `MAIL_REPLY_TO` defaults to the sender, `MAIL_TIMEOUT` to 15 seconds and `EMAIL_VERIFICATION_TTL` to 3600 seconds. Only authenticated SMTP and the existing PHP `mail` transport are implemented; other Laravel mailers and `MAIL_SCHEME` are not configuration options here.

## 3. Verify delivery

Sign in to **ReGen Administration → Email → Test Email**. Send one test to your own address and check the inbox and spam folder. Then test registration and its verification link. Look for `registration_verification`, then `welcome` after you verify. Confirm a sandbox purchase and look for `payment_receipt` in recent delivery results.

### Start the DirectAdmin worker

1. Deploy the updated release. In SSH or the hosting terminal, run the command below using your host's actual PHP 8.3+ CLI binary and site path. It reads queue counts and the last worker run without sending any mail.

   ```sh
   /path/to/php /home/ACCOUNT/domains/DOMAIN/public_html/_app/jobs/process-notifications.php --status
   ```

2. In **DirectAdmin → User Level → Cron Jobs**, create one job. Set **Minute**, **Hour**, **Day of month**, **Month** and **Day of week** to `*`. Paste the command below in **Command**, substituting the same paths. Keep the log outside the web root and rotate it using your hosting tools.

   ```sh
   /path/to/php /home/ACCOUNT/domains/DOMAIN/public_html/_app/jobs/process-notifications.php >> /home/ACCOUNT/regen-notifications.log 2>&1
   ```

3. After two minutes, run `--status` again. `lastWorkerRunUtc` should have advanced, and the Notifications admin screen should show that the worker ran. If it hasn't, inspect the private log and confirm the job runs under the same hosting account with access to the deployed application and its configuration.

| Symptom | Check next |
| --- | --- |
| Broadcast remains queued | Check the worker timestamp. In-app delivery can run even without SMTP. Email also needs both the global announcement setting and recipient opt-in. |
| HitPay took payment but ReGen still shows Awaiting payment | Check the [HitPay webhook setup](HITPAY_CHECKOUT.md) and provider delivery log. A checkout redirect alone does not create a receipt. |
| ReGen shows Paid but no email arrived | Check the worker timestamp and recent email delivery results. If `mailConfigured` is false, set up SMTP. If accepted, check the account email address, spam folder, and provider delivery logs. Review failures before retrying any uncertain delivery. |

The worker can deliver messages already in the queue once cron and SMTP are running. It does not recreate receipts for past orders that never entered the queue.

If delivery fails:

| Symptom | Check |
| --- | --- |
| Not configured | Host, username, password, sender address and HTTPS `APP_URL` are filled in. |
| Connection / TLS failure | Exact SMTP hostname and the matching 465/ssl or 587/tls pair. Ask whether your hosting plan allows outgoing SMTP. Keep certificate checking enabled. |
| Authentication rejected | Full mailbox address and mailbox password; confirm you can sign in to webmail. |
| Sender rejected | Use the authenticated mailbox as the sender. |
| Accepted but missing / spam | Check mailbox quota and spam; ask your provider to verify SPF, DKIM and mail-server delivery logs. User-level DNS access depends on your plan. |

Email setup is separate from Google sign-in. Google token verification does not send a verification email through SMTP.

Provider reference: [DirectAdmin user-level email client configuration](https://docs.directadmin.com/other-hosting-services/dovecot/user-level.html). Variable naming reference: [Laravel's mail configuration](https://github.com/laravel/laravel/blob/13.x/config/mail.php). ReGen supports the subset described above, without requiring Laravel.
