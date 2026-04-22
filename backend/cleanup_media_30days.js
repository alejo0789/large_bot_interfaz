/**
 * Cleanup Media Script
 * 
 * This script deletes files in the uploads directory that are older than 30 days.
 * It recursively checks all subdirectories (tenant folders).
 */
const fs = require('fs');
const path = require('path');
const { config } = require('./src/config/app');

// --- CONFIGURATION ---
const DAYS_TO_KEEP = 30;
const THRESHOLD_MS = DAYS_TO_KEEP * 24 * 60 * 60 * 1000;
const NOW = Date.now();
const TARGET_DIR = config.uploadDir;

console.log('--- Media Cleanup Started ---');
console.log(`Target directory: ${TARGET_DIR}`);
console.log(`Retention period: ${DAYS_TO_KEEP} days`);
console.log('------------------------------');

if (!fs.existsSync(TARGET_DIR)) {
    console.error('❌ Error: Upload directory does not exist.');
    process.exit(1);
}

let deletedFilesCount = 0;
let deletedBytesCount = 0;
let scannedFilesCount = 0;

/**
 * Recursively scan directory and delete old files
 */
function cleanupDir(dirPath) {
    const items = fs.readdirSync(dirPath);

    items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            // Recursively process subdirectory
            cleanupDir(fullPath);
            
            // Optional: Remove empty directories after cleaning them
            try {
                if (fs.readdirSync(fullPath).length === 0) {
                    fs.rmdirSync(fullPath);
                    console.log(`📁 Removed empty directory: ${path.relative(TARGET_DIR, fullPath)}`);
                }
            } catch (err) {
                // Ignore errors if directory is not empty or can't be deleted
            }
        } else {
            scannedFilesCount++;
            const ageMs = NOW - stats.mtimeMs;

            if (ageMs > THRESHOLD_MS) {
                try {
                    const fileSize = stats.size;
                    fs.unlinkSync(fullPath);
                    deletedFilesCount++;
                    deletedBytesCount += fileSize;
                    console.log(`✅ Deleted: ${path.relative(TARGET_DIR, fullPath)} (${(ageMs / (24 * 60 * 60 * 1000)).toFixed(1)} days old)`);
                } catch (err) {
                    console.error(`❌ Failed to delete ${fullPath}:`, err.message);
                }
            }
        }
    });
}

try {
    cleanupDir(TARGET_DIR);

    const totalMB = (deletedBytesCount / (1024 * 1024)).toFixed(2);
    console.log('------------------------------');
    console.log('--- Cleanup Finished ---');
    console.log(`Scanned files: ${scannedFilesCount}`);
    console.log(`Deleted files: ${deletedFilesCount}`);
    console.log(`Space recovered: ${totalMB} MB`);
} catch (err) {
    console.error('❌ Critical error during cleanup:', err.message);
}
