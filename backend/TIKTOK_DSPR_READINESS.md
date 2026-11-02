# TikTok Business Messaging DSPR readiness (internal)

**Status:** TikTok is reviewing the Data Security and Privacy Review (DSPR). The successful `DIRECT_MESSAGE` webhook registration only confirms the app-level callback configuration; it does not establish that TikTok granted Business Messaging access or that an account authorized inbox access.

## Evidence currently present in the code

- TikTok OAuth uses a one-time state value with a 10-minute expiry and checks the configured redirect URL.
- TikTok access and refresh tokens are encrypted with AES-256-GCM before storage in the master database. The encryption key is supplied through `TIKTOK_TOKEN_ENCRYPTION_KEY`.
- Only workspace administrators can start or manage the TikTok connection, and connection records are scoped by tenant.
- The webhook validates TikTok's HMAC-SHA256 signature and rejects timestamps older than five minutes.
- Inbound messages are deduplicated by provider message ID and stored in the owning tenant's database.
- An administrator can disconnect a workspace and delete TikTok-prefixed conversations, messages, and recognizable `n8n_chat_histories` sessions. A deletion audit stores the workspace, administrator ID, status, and deleted row counts, not message content.

## Gaps that must be resolved before making DSPR claims

- The application encrypts tokens, but message text, sender names, and identifiers are stored as ordinary database fields. Verify the database provider's encryption-at-rest controls and obtain its evidence. Do not claim application-layer encryption for message content.
- No automatic retention period for active TikTok conversations is configured. Define the retention period with the business and implement or document how it is enforced.
- Disconnect removes the CRM's stored credentials and identifiable TikTok conversations. The account owner must also remove/revoke the app from TikTok's own authorization settings. Confirm the exact user-facing revocation instructions in TikTok's portal.
- The disconnect action is workspace-wide. The CRM can delete one conversation, but there is no public request intake/confirmation workflow for an individual TikTok person's access, correction, or erasure request. Document the support process and how the operator handles copies.
- If a deleted TikTok conversation is linked to a payment record, the database unlinks the conversation but retains the payment record. Decide and document whether that information must remain for accounting/legal reasons and how it is minimized.
- There is no dedicated TikTok data export/update request flow. Define how support verifies identity and supplies or corrects data when a request is valid.
- A publicly reachable privacy policy URL and a real privacy contact have not been verified. The current Terms page references a separate privacy policy, so that reference must resolve to a real, current document before submission.
- Confirm all processors and data locations (including Railway, database hosting, and any automation or AI services that might receive TikTok data) and describe international transfers accurately.
- Organizational evidence is outside this repository: approved security/privacy policies, MFA/access review records, incident response process and exercise, vulnerability or penetration-test report, endpoint/network controls, and any ISO 27001 or SOC 2 evidence. Provide only controls the organization actually operates.

## Submission gate

Do not represent the app as approved for Business Messaging until TikTok completes DSPR and the app's permissions page grants the required messaging access. Test with an account that has explicitly authorized inbox read and message-send permissions before claiming end-to-end message access.

## Owner decisions needed

- Legal entity and public privacy-contact details.
- Retention period for messages while a workspace remains connected.
- Whether deletion should be immediate on disconnect or after a documented export/retention window.
- Which subprocessors receive TikTok message content, and the applicable data regions.
