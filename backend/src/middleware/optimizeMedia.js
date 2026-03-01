const path = require('path');
const fs = require('fs');

// Lazy-load sharp and ffmpeg safely — native binaries may not be available in all environments
let sharp = null;
let ffmpeg = null;

try {
    sharp = require('sharp');
} catch (e) {
    console.warn('⚠️ sharp not available — image optimization disabled:', e.message);
}

try {
    const ffmpegLib = require('fluent-ffmpeg');
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
        ffmpegLib.setFfmpegPath(ffmpegStatic);
        ffmpeg = ffmpegLib;
    }
} catch (e) {
    console.warn('⚠️ ffmpeg not available — audio optimization disabled:', e.message);
}

/**
 * Express middleware to optimize uploaded media before processing.
 * If optimization tools are unavailable, the original file passes through unmodified.
 */
const optimizeMedia = async (req, res, next) => {
    if (!req.file) return next();

    const { mimetype, path: filePath, filename } = req.file;

    try {
        // Optimización de imágenes (excepto GIFs para no perder animación)
        if (sharp && mimetype.startsWith('image/') && mimetype !== 'image/gif') {
            const ext = path.extname(filename);
            const optimizedPath = filePath.replace(ext, `_opt${ext}`);

            await sharp(filePath)
                .resize(1280, 1280, {
                    fit: 'inside', // Mantiene la relación de aspecto sin distorsionar
                    withoutEnlargement: true
                })
                .jpeg({ quality: 75, progressive: true, force: false })
                .png({ compressionLevel: 8, progressive: true, force: false })
                .webp({ quality: 75, force: false })
                .toFile(optimizedPath);

            fs.unlinkSync(filePath);
            fs.renameSync(optimizedPath, filePath);

            const stats = fs.statSync(filePath);
            const oldSize = req.file.size;
            req.file.size = stats.size;

            const savedPercentage = ((oldSize - stats.size) / oldSize * 100).toFixed(1);
            console.log(`🖼️ Imagen optimizada: ${filename} (De ${(oldSize / 1024).toFixed(1)}KB a ${(stats.size / 1024).toFixed(1)}KB - Ahorro: ${savedPercentage}%)`);
            return next();
        }
        // Optimización de audios (Notas de voz / Canciones)
        else if (ffmpeg && mimetype.startsWith('audio/')) {
            const ext = path.extname(filename);
            const optimizedPath = filePath.replace(ext, `_opt.mp3`);

            console.log(`🎵 Comprimiendo audio: ${filename}...`);
            const oldSize = req.file.size;

            ffmpeg(filePath)
                .audioCodec('libmp3lame')
                .audioBitrate('64k') // 64kbps es ideal para notas de voz en WhatsApp, reduce peso considerablemente
                .on('end', () => {
                    try {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Eliminar original
                        fs.renameSync(optimizedPath, filePath); // Reemplazar con el comprimido manteniendo el nombre original

                        const stats = fs.statSync(filePath);
                        req.file.size = stats.size;
                        const savedPercentage = ((oldSize - stats.size) / oldSize * 100).toFixed(1);
                        console.log(`✅ Audio optimizado: ${filename} (De ${(oldSize / 1024).toFixed(1)}KB a ${(stats.size / 1024).toFixed(1)}KB - Ahorro: ${savedPercentage}%)`);
                        return next();
                    } catch (err) {
                        console.error('❌ Error al reemplazar audio optimizado:', err);
                        return next();
                    }
                })
                .on('error', (err) => {
                    console.error('❌ Error al comprimir audio:', err);
                    // Si falla, pasamos el archivo original para que no se arruine el flujo
                    return next();
                })
                .save(optimizedPath);

            return; // Esperamos asícronamente a ffmpeg
        }
    } catch (error) {
        console.error('❌ Error general al optimizar archivo:', {
            filename: req.file ? req.file.filename : 'unknown',
            path: req.file ? req.file.path : 'unknown',
            error: error.message
        });
        // IMPORTANT: Always call next() even on error to prevent hanging requests
        return next();
    }

    // Default para documentos, videos sin soporte (o fallos)
    next();
};

module.exports = optimizeMedia;
