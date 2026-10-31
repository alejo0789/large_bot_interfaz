/*
 * Legacy manual TikTok OAuth helper retired.
 *
 * Use the CRM Settings > TikTok flow instead. It validates the one-time state,
 * exchanges the authorization code on the backend, and stores credentials
 * encrypted per tenant. Do not put TikTok app secrets or access tokens in this
 * script or in command-line arguments.
 *
 * Setup instructions: backend/TIKTOK_OAUTH_SETUP.md
 */
console.log('This legacy helper has been retired. Use Settings > TikTok in the CRM.');
