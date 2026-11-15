# HitPay hosted checkout

## Set up a sandbox purchase

1. **Put ReGen on a test HTTPS address.** Use an existing staging site or create a staging subdomain in DirectAdmin. In File Manager, extract `regen-php.zip` into that subdomain’s document root, where `index.php` and `.htaccess` should be at the top level. Create a separate test database in **MySQL Management**. In phpMyAdmin, select that database and use **Import** to upload `database/schema.sql` from this project for a fresh installation. If staging already has ReGen through migration 025, import only `database/migrations/026_hitpay_orders.sql`. Apply earlier missing migrations in order if needed. See the first installation section of [the DirectAdmin deployment guide](../DEPLOYMENT_DIRECTADMIN.md) for administrator setup.

2. **Create your HitPay sandbox account.** Register separately in the sandbox, choose **Singapore** as the business country, and activate your email. Sign in and enable **Cards** under **Settings → Payment Methods**. Open **Settings → API Keys**, generate a sandbox key, and copy the business API key. [Sandbox registration](https://dashboard.sandbox.hit-pay.com/register) · [Sandbox sign-in](https://dashboard.sandbox.hit-pay.com/login) · [HitPay sandbox guide](https://docs.hitpayapp.com/apis/guide/sandbox)

3. **Register the endpoint that confirms orders.** In the sandbox dashboard, open **Developers → Webhook Endpoints → New Webhook**. Name it `ReGen Sandbox` and enter `https://staging.your-domain.example/api/webhooks/hitpay/sandbox`, substituting your actual staging hostname. Select `payment_request.completed`, `payment_request.failed`, and `charge.updated`. Save, reopen the endpoint, and copy its **signing salt** from the endpoint details. HitPay must be able to reach the URL over public HTTPS. [HitPay webhook setup](https://docs.hitpayapp.com/apis/guide/online-payments#register-your-webhook) · [Endpoint signing salt](https://docs.hitpayapp.com/apis/guide/events#per-webhook-salt-developers-%E2%86%92-webhooks)

4. **Enter both values in the staging server’s `.env`.** In the DirectAdmin ZIP layout, this is the protected file next to `index.php`. On a fresh install, copy `.env.example` to `.env` and fill in the staging database credentials. Keep your actual values in that file and verify that the staging address followed by `/.env` returns **403** before adding the credentials. Replace the example hostname and both `PASTE_` values below.

   ```dotenv
   APP_ENV=staging
   APP_URL=https://staging.your-domain.example
   SESSION_DRIVER=database
   HITPAY_MODE=sandbox
   HITPAY_API_KEY=PASTE_SANDBOX_BUSINESS_API_KEY
   HITPAY_SANDBOX_WEBHOOK_SALT=PASTE_SIGNING_SALT_FROM_REGEN_SANDBOX_ENDPOINT
   HITPAY_LIVE_WEBHOOK_SALT=
   ```

   Open `/api/health` on staging and check that it reports success. Use a verified ReGen test customer account for checkout. For a fresh staging site, configure email delivery and reCAPTCHA for that hostname, then register and verify a test account.

5. **Create something to buy.** In staging ReGen admin, open **Pricing → Packages → Add package**. Set the name to `Sandbox Test Tokens`, the package type to **Token bundle**, the price to `10.00`, and the currency to **SGD**. Open **Include saved tokens**, enter `10` for **Tokens**, and leave bonus tokens at zero. Leave the free claim checkbox off, check **Publish package**, and select **Save package**. In **Pricing → Store presentation**, make sure **Publish packages in the store** is enabled.

6. **Pay from the ReGen Store.** Sign in to staging as the test customer. Open **ReGen Store → View package → Continue to HitPay**. Check that the checkout hostname is `checkout.sandbox.hit-pay.com` or `securecheckout.sandbox.hit-pay.com`. Choose **Card** and use HitPay’s test Visa `4242 4242 4242 4242` with a future expiry, such as `12/30`, and CVC `123`. Finish the sandbox checkout and return to ReGen. [HitPay test cards](https://docs.hitpayapp.com/apis/guide/sandbox#test-cards)

7. **Verify the result.** ReGen shows **Payment successful** after the signed confirmation arrives. The customer’s saved token balance should increase by 10. With the notification worker running and SMTP configured, check the buyer’s inbox for a receipt. In admin, open **Pricing → Payment history** and find the same `RG-` reference marked **Paid** and **Sandbox**. You can repeat with HitPay’s declined test card `4000 0000 0000 0002` and check that the balance stays the same. To test refund reporting, issue a sandbox refund in HitPay and refresh both ReGen histories. [HitPay test cards](https://docs.hitpayapp.com/apis/guide/sandbox#test-cards)

| What you see | Where to check |
| --- | --- |
| ReGen shows **Checkout is currently unavailable** on the package | Check the staging `.env` for `APP_ENV=staging`, `HITPAY_MODE=sandbox`, the HTTPS `APP_URL`, and both sandbox values. Confirm the package is published with a price and the Store is enabled. |
| ReGen creates a payment entry but HitPay never opens | Search the hosting PHP error log for `[HitPay checkout]` and that order’s `RG-` reference. The entry identifies the failing stage and includes `curl_errno` and `http_status` when available. An HTTP status of `0` means cURL received no HTTP response. cURL errors `6`, `7`, `28`, and `60` point to DNS, connection, timeout, and certificate verification respectively. For a nonzero HTTP status, also check **Developers → Request Logs** in HitPay Sandbox. |
| HitPay returns HTTP `422` | The checkout request was rejected. The PHP log lists known rejected fields in `validation_fields`; `unknown` means HitPay did not return a recognized field. In **Developers → Request Logs**, find the attempt and look at the response’s `errors` section. Keep request headers, keys and signing salts private. If the sandbox account was created for Singapore, try the separate SGD test package in step 5 before testing MYR. An SGD success verifies the sandbox checkout path; it does not verify MYR acceptance. |
| HitPay shows success while ReGen still says **Awaiting payment** | Open **Developers → Webhook Endpoints** and check the delivery log for `payment_request.completed`. Verify the staging hostname, the `/sandbox` endpoint path, and the endpoint’s own salt. ReGen records payment when it receives the signed confirmation. |

## Enable live checkout after sandbox verification

After sandbox verification, register the live webhook on the live merchant account. Set `HITPAY_MODE=live` and install the live API key and signing salt on production. `HITPAY_MODE=disabled` pauses new checkout links. Existing confirmations can still be accepted while their webhook salt is configured.

ReGen stores the purchase amount, currency and benefits as quoted. A valid signed completion for the matching request and successful charge records payment and grants the purchased benefits in the same transaction. Refreshing the return page only reads order status. The checkout URL stays in payment history while the link is valid.

Refunds issued in HitPay appear in both histories. If a refund arrives after the package was delivered, review the account in **User accounts → Packages** and adjust or revoke access there if appropriate. This preserves the administrator’s control over credits that may have been used.

[HitPay online payments](https://docs.hitpayapp.com/apis/guide/online-payments) · [HitPay webhook events and signing](https://docs.hitpayapp.com/apis/guide/events) · [HitPay sandbox](https://docs.hitpayapp.com/apis/guide/sandbox)
