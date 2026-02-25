/**
 * Phone Number Utilities
 */

/**
 * Normalizes a phone number to a consistent format (+digits)
 * @param {string} phone - The phone number or JID to normalize
 * @returns {string} The normalized phone number
 */
function normalizePhone(phone) {
    if (!phone) return phone;

    // Handle special WhatsApp IDs (groups, etc)
    if (String(phone).includes('@g.us') || String(phone).includes('-')) {
        return String(phone);
    }

    // For standard numbers, strip everything but digits
    const digits = String(phone).replace(/\D/g, '');

    // Return with + prefix for consistency
    if (digits.length > 0) {
        return `+${digits}`;
    }

    return String(phone);
}

/**
 * Returns digits only for API calls that require it
 * @param {string} phone - Normalized or original phone
 * @returns {string} Digits only
 */
function getPureDigits(phone) {
    if (!phone) return phone;
    return String(phone).replace(/\D/g, '');
}

module.exports = {
    normalizePhone,
    getPureDigits
};
