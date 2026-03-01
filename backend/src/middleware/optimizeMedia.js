const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Configurar ffmpeg para usar el binario descargado
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Express middleware to optimize uploaded media before processing
 * Soporta compresión de imágenes con sharp y audios con ffmpeg.
 */
const optimizeMedia = async (req, res, next) => {
    if (!req.file) return next();

    const { mimetype, path: filePath, filename } = req.file;

    try {
        // Optimización de imágenes (excepto GIFs para no perder animación)
        if (mimetype.startsWith('image/') && mimetype !== 'image/gif') {
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
        else if (mimetype.startsWith('audio/')) {
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
        console.error('â Œ Error general al optimizar archivo:', {
            filename: req.file.filename,
            path: req.file.path,
            error: error.message
        });
    }

    // Default para documentos, videos sin soporte (o fallos)
    next();
};

module.exports = optimizeMedia;
