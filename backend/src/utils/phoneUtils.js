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

    let phoneStr = String(phone);

    // Handle groups
    if (phoneStr.includes('@g.us') || phoneStr.includes('-')) {
        return phoneStr;
    }

    // Extract digits and remove suffixes like @s.whatsapp.net or @lid
    let cleanPart = phoneStr.includes('@') ? phoneStr.split('@')[0] : phoneStr;
    let digits = cleanPart.replace(/\D/g, '');

    // ADVANCED COLOMBIAN LID DETECTION
    // Colombian mobile numbers are exactly 10 digits and start with 3 (300, 310, 320, 350, ecc).
    // WhatsApp LIDs (Linked Identities) often embed these 10 digits inside a longer string.
    // We look specifically for 30x, 31x, 32x, 35x which are the standard mobile prefixes.
    const colMatch = digits.match(/(30|31|32|35)\d{8}/);
    if (colMatch) {
        return '+57' + colMatch[0];
    }

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
