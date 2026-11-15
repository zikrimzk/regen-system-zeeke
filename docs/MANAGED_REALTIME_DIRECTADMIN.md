# Managed live updates on DirectAdmin

This release replaces PHP-held event streams with **Pusher Channels private connections** and short, adaptive recovery requests. No idle PHP worker is reserved for each connected user. The existing PHP/MySQL application and normal APIs remain in place.

## Create the service app

1. Open [Pusher Channels](https://dashboard.pusher.com/) and create a Channels app. Choose the region appropriate to your deployment. Use **Channels**, rather than Beams.
2. Leave client-triggered events disabled. ReGen publishes changes from its authenticated backend.
3. Open **App Keys**. Copy the app ID, public key, secret and cluster into the private `.env` file in DirectAdmin File Manager:

```dotenv
REALTIME_TRANSPORT=auto
PUSHER_APP_ID=YOUR_APP_ID
PUSHER_APP_KEY=YOUR_PUBLIC_KEY
PUSHER_APP_SECRET="YOUR_PRIVATE_SECRET"
PUSHER_APP_CLUSTER=YOUR_APP_CLUSTER
```

Do not paste the secret into chat, JavaScript, Git or a public file. The cluster must exactly match the app. The browser receives only the public key and its authorized channel names. No Pusher account was created or paid plan purchased during implementation.

## Deploy the update

1. Back up the database and application. Apply missing migrations in order, including **017_realtime_and_maintenance.sql**, **018_managed_realtime_delivery.sql** and **019_support_and_token_store.sql**. Fresh installations use the complete current schema.
2. Upload the complete `release/regen-php.zip`, preserving your private `.env`, uploads and storage. Keep the existing notification cron enabled.
3. Ensure outbound HTTPS to the app's Pusher API cluster is allowed. Use HTTPS for ReGen. Enable OPcache and retain spare PHP capacity for normal requests and occasional bounded delivery work.
4. Reload existing browser tabs once to replace the old live client. An old `/api/realtime/events` request now returns immediately with HTTP 410; it cannot hold a PHP worker.
5. Sign in as a user and an administrator in separate browser profiles. Publish an announcement, submit/reply to a ticket and mark notifications as read. Confirm the open conversation, work counts and unread badges update without a reload. Confirm the admin header says **Live updates**.

The official PHP SDK 7.3.0 is locked in Composer. The official browser SDK 8.6.0 and its MIT license are bundled locally; its package integrity was verified against the npm SHA512 digest. No remotely hosted script is required. The content security policy allows only the configured cluster's secure WebSocket endpoint.

## Recovery and service outages

Without complete provider configuration, ReGen uses **Automatic updates**. This uses one short authenticated delta request at a time, with adaptive intervals of roughly 4–15 seconds while visible. It is not instant push. Tabs share a connection/check loop using Web Locks and BroadcastChannel where supported. Hidden tabs stop their transport and outstanding reads.

Managed wakeups trigger a coalesced permission-checked delta read. A separate 30-second safety check recovers missed signals. Connection failures continue through the short-check path; they do not repeatedly reload management pages. HTTP failures use exponential backoff and retry-after handling. Subscription authorization is batched and CSRF protected. Browser lifecycle changes cancel requests and suppress stale completions.

Provider publication happens after committed changes. PHP-FPM finishes the user response before bounded delivery work. Other runtimes use strict provider timeouts and a shared circuit breaker. Failed delivery does not roll back the user's action; its durable checkpoint remains for the existing cron worker to retry. Keep that worker running: delayed recovery is necessary after a provider outage. In-app notification history remains in ReGen's own database.

Set `REALTIME_TRANSPORT=poll` to explicitly disable external managed connections. Legacy `sse` configuration no longer opens PHP-held streams.

## Privacy and production verification

Pusher receives only a generic `wake` signal, private channel identifiers and ordinary connection metadata. Resume contents, ticket messages, email addresses and credentials are not sent in event payloads. All application data and replay events are fetched through ReGen's existing session and module checks. Configure the provider account and its data-processing settings as part of your production privacy review.

The local suites test authorization, batching, durable retry, replay, maintenance and ordinary requests running alongside update checks. Managed provider behavior is tested with a mock transport. **Real Pusher connectivity, actual hosting capacity and external email delivery still require verification after your app is configured.** Local single-worker load results are diagnostic measurements, not a high-volume production guarantee. Closed-tab operating-system Web Push is a separate feature and is not implemented here.

References: [private channels](https://pusher.com/docs/channels/using_channels/private-channels/), [HTTP publishing](https://pusher.com/docs/channels/server_api/http-api/), [official JavaScript client](https://github.com/pusher/pusher-js), [official PHP client](https://github.com/pusher/pusher-http-php).
