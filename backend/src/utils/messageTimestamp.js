// Provider timestamps can be Unix seconds, milliseconds, or protobuf Long objects.
function parseMessageTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'object') {
        if (!Number.isInteger(value.low) || !Number.isInteger(value.high)) return null;
        value = (value.high >>> 0) * 4294967296 + (value.low >>> 0);
    }
    if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) return null;
        value = numeric < 1e12 ? numeric * 1000 : numeric;
    } else if (typeof value === 'string') {
        value = value.trim().replace(' ', 'T');
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
        // Legacy database timestamps without a zone represent UTC.
        if (!/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(value)) value += 'Z';
        value = value.replace(/([+-]\d{2})$/, '$1:00');
    } else {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = { parseMessageTimestamp };
