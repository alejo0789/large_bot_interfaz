# Instagram Messaging setup

The CRM uses Meta Login for Business, stores the connected Page token encrypted in the master database, and uses the linked professional Instagram account for messaging.

## Railway backend variables

Set these in the backend service. Keep app secrets and encryption keys in Railway variables, never in Git:

```env
META_APP_ID=1061225610068744
META_APP_SECRET=<Meta App Secret>
META_GRAPH_API_VERSION=v22.0
INSTAGRAM_LOGIN_URL=https://www.facebook.com/dialog/oauth?client_id=1061225610068744&config_id=1759190518491339&display=popup&override_default_response_type=true&redirect_uri=https%3A%2F%2Flargebotinterfaz-production-5b38.up.railway.app%2Fapi%2Finstagram%2Foauth%2Fcallback&response_type=code&state=%3CSTATE%3E&prompt=login
INSTAGRAM_REDIRECT_URI=https://largebotinterfaz-production-5b38.up.railway.app/api/instagram/oauth/callback
META_TOKEN_ENCRYPTION_KEY=<32 random bytes, as 64 hex characters>
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<long random value you choose>
```

The backend replaces the URL's placeholder `state` with a cryptographically random, short-lived, single-use value. `INSTAGRAM_REDIRECT_URI` must match the URL registered in Meta exactly. Use the same `META_TOKEN_ENCRYPTION_KEY` across backend restarts; changing it makes existing stored tokens unreadable and requires reconnecting accounts.

Generate keys locally without sharing them in chat:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate one value for the encryption key and another for the webhook verify token. The verify token is a password you choose; Meta sends it back only during webhook verification.

## Meta Developers configuration

1. Add the callback URI above to the Facebook Login for Business redirect URI allowlist. Keep the supplied login configuration (`config_id`) and enable the Page and Instagram messaging permissions required by the app's product/configuration.
2. Make sure the Instagram account is Professional (Business or Creator), linked to a Facebook Page, and the authorizing user has the needed Page access.
3. Configure the Instagram messaging webhook callback as `https://largebotinterfaz-production-5b38.up.railway.app/webhook/instagram`, using the exact `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` value. Subscribe the app to Instagram `messages` events (and message attachments if needed).
4. After webhook verification, add the app to the connected Instagram account's webhook subscriptions if Meta's dashboard/API requires it for the selected login product.
5. The app may need App Review and Live mode before accounts outside app roles can authorize messaging permissions.

## CRM flow

An administrator opens Ajustes → Instagram → Conectar cuenta Instagram. Meta redirects to the callback, the backend finds the linked Page and professional Instagram account, encrypts the Page token in the master database, and associates it with the current workspace. Incoming text and attachment notices appear in the Instagram channel. Agents can send text replies from the CRM while the Instagram conversation is eligible under Meta's messaging rules.

The current webhook stores text and attachment placeholders; it does not download media or start an AI/n8n automation. Manual text replies use the connected Instagram account.
