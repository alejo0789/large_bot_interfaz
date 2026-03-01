const fs = require('fs');
const path = require('path');
const { config } = require('../config/app');
const { tenantContext } = require('../utils/tenantContext');

/**
 * Save base64 data as a file to the uploads directory
 * MULTI-TENANT AWARE: saves to subfolder per tenant slug
 * @param {string} base64Data - Base64 string
 * @param {string} mediaType - Type of media
 * @param {string} mimetype - Mimetype
 * @returns {string|null} - The public URL of the saved file
 */
const saveBase64AsFile = async (base64Data, mediaType, mimetype) => {
    try {
        if (!base64Data) return null;

        // Get tenant from context
        const context = tenantContext.getStore();
        const tenantSlug = context?.tenant?.slug;

        let destinationDir = config.uploadDir;
        let publicPrefix = '/uploads';

        if (tenantSlug) {
            destinationDir = path.join(config.uploadDir, tenantSlug);
            publicPrefix = `/uploads/${tenantSlug}`;
        }

        // Ensure directory exists
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
        }

        // Strip data URI prefix if present
        const base64Content = base64Data.includes('base64,')
            ? base64Data.split('base64,')[1]
            : base64Data;

        // Determine extension
        let extension = 'bin';
        if (mimetype) {
            extension = mimetype.split('/')[1]?.split(';')[0] || extension;
        } else {
            if (mediaType === 'image') extension = 'jpg';
            if (mediaType === 'video') extension = 'mp4';
            if (mediaType === 'audio') extension = 'ogg';
        }

        if (extension.includes('codecs=')) extension = 'ogg';

        const filename = `${mediaType}_${Date.now()}_${Math.round(Math.random() * 1E9)}.${extension}`;
        const filePath = path.join(destinationDir, filename);

        // Write file
        fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));

        console.log(`💾 File saved to tenant [${tenantSlug || 'master'}] disk: ${filePath}`);

        // Return public URL
        return `${config.publicUrl}${publicPrefix}/${filename}`;
    } catch (error) {
        console.error('❌ Error saving base64 to file:', error);
        return null;
    }
};

module.exports = { saveBase64AsFile };
