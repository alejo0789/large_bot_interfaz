/**
 * File Upload Middleware
 * Multer configuration for handling file uploads
 * MULTI-TENANT AWARE: saves to subfolder per tenant slug
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { config } = require('../config/app');
const { tenantContext } = require('../utils/tenantContext');

// Ensure base upload directory exists
if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
}

/**
 * Get the upload directory for the current tenant.
 * If no tenant context is active (e.g. public route), use base uploadDir.
 */
const getTenantUploadDir = () => {
    const context = tenantContext.getStore();
    const slug = context?.tenant?.slug;
    if (slug) {
        const tenantDir = path.join(config.uploadDir, slug);
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }
        return { dir: tenantDir, subPath: slug };
    }
    return { dir: config.uploadDir, subPath: null };
};

/**
 * Get the public URL for an uploaded file, including tenant subfolder if applicable.
 */
const getUploadUrl = (filename) => {
    const { subPath } = getTenantUploadDir();
    if (subPath) {
        return `${config.publicUrl}/uploads/${subPath}/${filename}`;
    }
    return `${config.publicUrl}/uploads/${filename}`;
};

// Storage configuration — tenant-aware directory
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { dir } = getTenantUploadDir();
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (config.allowedFileTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido'), false);
    }
};

// Create multer instance
const upload = multer({
    storage,
    limits: { fileSize: config.maxFileSize },
    fileFilter
});

// Helper to determine media type
const getMediaType = (mimetype) => {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
};

module.exports = { upload, getMediaType, getUploadUrl };
