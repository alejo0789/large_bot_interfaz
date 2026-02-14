const fs = require('fs');
const path = require('path');
const { config } = require('../config/app');

/**
 * Save base64 data as a file to the uploads directory
 * @param {string} base64Data - Base64 string (without data prefix if possible, but handles both)
 * @param {string} mediaType - Type of media (image, video, audio, document)
 * @param {string} mimetype - Mimetype (e.g. image/jpeg)
 * @returns {string|null} - The public URL of the saved file or null on failure
 */
const saveBase64AsFile = async (base64Data, mediaType, mimetype) => {
    try {
        if (!base64Data) return null;

        // Strip data URI prefix if present
        const base64Content = base64Data.includes('base64,')
            ? base64Data.split('base64,')[1]
            : base64Data;

        // Determine extension
        let extension = 'bin';
        if (mimetype) {
            extension = mimetype.split('/')[1]?.split(';')[0] || extension;
        } else {
            // Fallback extensions
            if (mediaType === 'image') extension = 'jpg';
            if (mediaType === 'video') extension = 'mp4';
            if (mediaType === 'audio') extension = 'ogg';
        }

        // Clean extension (e.g. codecs=opus -> ogg)
        if (extension.includes('codecs=')) extension = 'ogg';

        const filename = `${mediaType}_${Date.now()}_${Math.round(Math.random() * 1E9)}.${extension}`;
        const filePath = path.join(config.uploadDir, filename);

        // Ensure directory exists
        if (!fs.existsSync(config.uploadDir)) {
            fs.mkdirSync(config.uploadDir, { recursive: true });
        }

        // Write file
        fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));

        console.log(`💾 File saved to disk: ${filePath}`);

        // Return public URL
        return `${config.publicUrl}/uploads/${filename}`;
    } catch (error) {
        console.error('❌ Error saving base64 to file:', error);
        return null;
    }
};

module.exports = { saveBase64AsFile };
