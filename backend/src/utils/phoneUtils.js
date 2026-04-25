/**
 * Phone Number Utilities
 */

/**
 * Normalizes a phone number to a consistent format (+digits)
 * @param {string} phone - The phone number or JID to normalize
 * @returns {string} The normalized phone number
 */
function normalizePhone(phone) {
    if (!phone) return null;

    let phoneStr = String(phone);

    // Handle groups
    if (phoneStr.includes('@g.us') || phoneStr.includes('-')) {
        return phoneStr;
    }

    // Extract digits and remove suffixes
    let cleanPart = phoneStr.includes('@') ? phoneStr.split('@')[0] : phoneStr;
    let digits = cleanPart.replace(/\D/g, '');

    // 1. WhatsApp LIDs should be kept as JID or explicitly marked
    // Groups are handled above. If it's 18+ digits, it's likely a group ID or LID.
    if (phoneStr.includes('@lid') || digits.length > 13) {
        // If it's already a JID, return it. If not, and it's 18+ digits, it's a group or LID.
        if (phoneStr.includes('@')) return phoneStr;
        // Default to @lid for long numeric IDs without domain, as Evolution expects JIDs
        return `${digits}@lid`;
    }

    // 2. Standardize Colombian numbers
    // Case A: 573123456789 (12 digits)
    if (digits.startsWith('573') && digits.length === 12) {
        return '+' + digits;
    }
    // Case B: 3123456789 (10 digits)
    if (digits.startsWith('3') && digits.length === 10) {
        return '+57' + digits;
    }

    // 3. Keep other standard numbers (10-13 digits)
    if (digits.length >= 10 && digits.length <= 13) {
        return `+${digits}`;
    }

    return null;
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
