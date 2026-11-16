const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file']);

function getIncomingMessageParts(message, providerId) {
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    if (!attachments.length) {
        return [{ whatsappId: providerId, text: message.text || '[Mensaje de Instagram]', mediaType: null, mediaUrl: null }];
    }

    return attachments.map((attachment, index) => {
        const type = attachment?.type;
        const url = attachment?.payload?.url;
        let mediaUrl = null;
        if (MEDIA_TYPES.has(type) && typeof url === 'string') {
            try {
                if (new URL(url).protocol === 'https:') mediaUrl = url;
            } catch (_) { /* Keep an unreadable attachment as a text placeholder. */ }
        }
        return {
            // Keep Meta's ID on the first part and stable IDs for additional attachments.
            whatsappId: index === 0 ? providerId : `${providerId}:attachment:${index}`,
            text: (index === 0 && message.text) || (mediaUrl ? null : `[Adjunto de Instagram: ${type || 'archivo'}]`),
            mediaType: mediaUrl ? type : null,
            mediaUrl
        };
    });
}

module.exports = { getIncomingMessageParts };
