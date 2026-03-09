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

    const phoneStr = String(phone);

    // Handle groups
    if (phoneStr.includes('@g.us') || phoneStr.includes('-')) {
        return phoneStr;
    }

    // Handle LIDs (WhatsApp Linked Identities) - Usually long numbers that cause duplicates
    // We keep the suffix to avoid collision with real phone numbers
    if (phoneStr.includes('@lid')) {
        return phoneStr;
    }

    // For standard numbers, strip everything but digits
    // If it has @s.whatsapp.net, we take only the digits part
    const cleanPart = phoneStr.includes('@') ? phoneStr.split('@')[0] : phoneStr;
    const digits = cleanPart.replace(/\D/g, '');

    // Return with + prefix for consistency
    if (digits.length > 0) {
        return `+${digits}`;
    }

    return phoneStr;
}

/**
 * Checks if a string is a WhatsApp LID
 */
function isLid(phone) {
    return String(phone).includes('@lid');
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
    getPureDigits,
    isLid
};
