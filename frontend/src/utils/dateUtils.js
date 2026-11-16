/** Dates are stored as instants and always displayed in Colombia's time zone. */
export const CHAT_TIME_ZONE = 'America/Bogota';

export const parseTimestamp = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
        value = value.trim();
        if (/^\d+(\.\d+)?$/.test(value)) value = Number(value);
        else {
            if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) return null;
            value = value.replace(' ', 'T');
            // Legacy API timestamps without an offset are UTC, never browser-local.
            if (!/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(value)) value += 'Z';
            value = value.replace(/([+-]\d{2})$/, '$1:00');
        }
    }
    if (typeof value === 'number') value = value < 1e12 ? value * 1000 : value;
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTime = (timestamp) => {
    const date = parseTimestamp(timestamp);
    return date ? date.toLocaleTimeString('es-CO', {
        timeZone: CHAT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false
    }) : '';
};

export const getDateKey = (timestamp) => {
    const date = parseTimestamp(timestamp);
    if (!date) return 'unknown';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: CHAT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return part('year') + '-' + part('month') + '-' + part('day');
};

const relativeDay = (timestamp) => {
    const key = getDateKey(timestamp);
    if (key === 'unknown') return null;
    const today = getDateKey(new Date());
    // Subtract a calendar day from Colombia's date, independently of the device zone.
    const yesterday = new Date(today + 'T12:00:00Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    if (key === today) return 'today';
    if (key === getDateKey(yesterday)) return 'yesterday';
    return 'other';
};

export const formatDateGroup = (timestamp) => {
    const date = parseTimestamp(timestamp);
    if (!date) return 'Sin fecha';
    const day = relativeDay(date);
    if (day === 'today') return 'Hoy';
    if (day === 'yesterday') return 'Ayer';
    return date.toLocaleDateString('es-CO', {
        timeZone: CHAT_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long',
        year: getDateKey(date).slice(0, 4) !== getDateKey(new Date()).slice(0, 4) ? 'numeric' : undefined
    });
};

/**
 * Group messages by date
 * @param {Array} messages - Array of message objects
 * @returns {Object} Messages grouped by date key
 */
export const groupMessagesByDate = (messages) => {
    if (!messages || !Array.isArray(messages)) return {};

    const groups = {};

    messages.forEach(message => {
        // Try multiple timestamp fields
        let rawTimestamp = message.rawTimestamp || message.timestamp;

        // If timestamp is just a time string (HH:MM), we can't group by date
        if (typeof rawTimestamp === 'string' && /^\d{1,2}:\d{2}$/.test(rawTimestamp)) {
            rawTimestamp = null;
        }

        const dateKey = getDateKey(rawTimestamp);

        if (!groups[dateKey]) {
            groups[dateKey] = {
                label: formatDateGroup(rawTimestamp),
                messages: []
            };
        }

        groups[dateKey].messages.push(message);
    });

    return groups;
};

/**
 * Get relative time string (e.g., "hace 5 minutos")
 * @param {string|number|Date} timestamp - The timestamp
 * @returns {string} Relative time string
 */
export const getRelativeTime = (timestamp) => {
    if (!timestamp) return '';

    try {
        const date = parseTimestamp(timestamp);
        if (!date) return '';

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays < 7) return `Hace ${diffDays} días`;

        return formatDateGroup(timestamp);
    } catch (error) {
        return '';
    }
};

/**
 * Get short date string (e.g., "Ayer", "12/10/23", or "" if today)
 * @param {string|number|Date} timestamp - The timestamp
 * @returns {string} Short date string
 */
export const getShortDate = (timestamp) => {
    const date = parseTimestamp(timestamp);
    if (!date) return '';
    const day = relativeDay(date);
    if (day === 'today') return '';
    if (day === 'yesterday') return 'Ayer';
    return date.toLocaleDateString('es-CO', {
        timeZone: CHAT_TIME_ZONE, day: '2-digit', month: '2-digit', year: '2-digit'
    });
};
