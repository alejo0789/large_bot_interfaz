# Instagram Messaging setup

The CRM uses the app's Instagram API Unified Login configuration. Meta grants an Instagram account asset and a system-user access token; a Facebook Page token is not required for this login configuration. Tokens are encrypted in the master database.

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

1. Keep the existing Unified Login configuration and callback URI. The CRM authorization URL must use its `config_id` and the same `META_APP_ID`.
2. Make sure the Instagram account is Professional (Business or Creator), is included as an asset in the Unified Login configuration, and the authorizing user grants access to it.
3. Configure the Instagram messaging webhook callback as `https://largebotinterfaz-production-5b38.up.railway.app/webhook/instagram`, using the exact `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` value. Subscribe the app to Instagram `messages` events (and message attachments if needed).
4. After webhook verification, add the app to the connected Instagram account's webhook subscriptions if Meta's dashboard/API requires it for the selected login product.
5. The app may need App Review and Live mode before accounts outside app roles can authorize messaging permissions.

## CRM flow

An administrator opens Ajustes → Instagram → Conectar cuenta Instagram. Meta redirects to the callback, the backend resolves the granted Instagram asset from the Unified Login token and encrypts the token in the master database, and associates it with the current workspace. Incoming text and attachment notices appear in the Instagram channel. Agents can send text replies from the CRM while the Instagram conversation is eligible under Meta's messaging rules.

The current webhook stores text and attachment placeholders; it does not download media or start an AI/n8n automation. Manual text replies use the connected Instagram account.
