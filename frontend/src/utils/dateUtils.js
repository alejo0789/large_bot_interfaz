/**
 * Date formatting utilities for the chat platform
 */

/**
 * Format a timestamp to a time string (HH:MM)
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted time string
 */
export const formatTime = (timestamp) => {
    if (!timestamp) return '';

    try {
        // If already formatted as HH:MM, return as-is
        if (typeof timestamp === 'string' && timestamp.match(/^\d{1,2}:\d{2}$/)) {
            return timestamp;
        }

        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';

        return date.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (error) {
        console.error('Error formatting time:', error);
        return '';
    }
};

/**
 * Format a timestamp to a date string for grouping
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date string (Hoy, Ayer, or date)
 */
export const formatDateGroup = (timestamp) => {
    if (!timestamp) return 'Sin fecha';

    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Sin fecha';

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Reset time for comparison
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

        if (dateOnly.getTime() === todayOnly.getTime()) {
            return 'Hoy';
        }

        if (dateOnly.getTime() === yesterdayOnly.getTime()) {
            return 'Ayer';
        }

        // For other dates, show full date
        return date.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    } catch (error) {
        console.error('Error formatting date group:', error);
        return 'Sin fecha';
    }
};

/**
 * Get the date key for grouping messages (YYYY-MM-DD)
 * @param {string|number|Date} timestamp - The timestamp
 * @returns {string} Date key in YYYY-MM-DD format
 */
export const getDateKey = (timestamp) => {
    if (!timestamp) return 'unknown';

    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'unknown';

        return date.toISOString().split('T')[0];
    } catch (error) {
        return 'unknown';
    }
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
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';

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
