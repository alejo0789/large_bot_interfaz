/**
 * Bulk Messaging Service
 * Handles mass message sending with rate limiting and progress tracking
 */

const BATCH_SIZE = 20; // Reduced batch size for safety
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds between batches
const MIN_MESSAGE_DELAY = 5000; // 5 seconds minimum between messages
const MAX_MESSAGE_DELAY = 20000; // 20 seconds maximum between messages

class BulkMessageService {
    constructor() {
        this.activeBatches = new Map(); // Track active bulk sends
    }

    /**
     * Process bulk send with progress tracking
     * @param {Object} options - Bulk send options
     * @param {string} options.batchId - Unique ID for this batch
     * @param {Array} options.recipients - Array of {phone, name}
     * @param {string} options.message - Message text
     * @param {string} options.mediaUrl - Optional media URL
     * @param {string} options.mediaType - Optional media type
     * @param {Function} options.sendFn - Function to send individual message
     * @param {Function} options.onProgress - Progress callback (sent, failed, total)
     * @param {Function} options.onComplete - Completion callback
     */
    async processBulkSend({
        batchId,
        recipients,
        message,
        mediaUrl = null,
        mediaType = null,
        sendFn,
        onProgress,
        onComplete
    }) {
        const total = recipients.length;
        let sent = 0;
        let failed = 0;
        const failedRecipients = [];
        const startTime = Date.now();

        console.log(`📤 Starting bulk send ${batchId}: ${total} recipients`);

        // Store batch info
        this.activeBatches.set(batchId, {
            status: 'processing',
            total,
            sent: 0,
            failed: 0,
            startTime
        });

        // Split into batches
        const batches = this.chunkArray(recipients, BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} messages)`);

            // Process each message in the batch
            for (const recipient of batch) {
                try {
                    await sendFn({
                        phone: recipient.phone,
                        name: recipient.name,
                        message,
                        mediaUrl,
                        mediaType
                    });
                    sent++;
                } catch (error) {
                    console.error(`❌ Failed to send to ${recipient.phone}:`, error.message);
                    failed++;
                    failedRecipients.push({
                        phone: recipient.phone,
                        name: recipient.name,
                        error: error.message
                    });
                }

                // Update progress
                if (onProgress) {
                    onProgress({
                        batchId,
                        sent,
                        failed,
                        total,
                        progress: Math.round(((sent + failed) / total) * 100),
                        currentBatch: batchIndex + 1,
                        totalBatches: batches.length
                    });
                }

                // Update stored batch info
                this.activeBatches.set(batchId, {
                    status: 'processing',
                    total,
                    sent,
                    failed,
                    startTime
                });

                // Random delay between messages to avoid detection/ban
                if (sent + failed < total) {
                    const delayMs = this.getRandomDelay(MIN_MESSAGE_DELAY, MAX_MESSAGE_DELAY);
                    console.log(`⏳ Waiting ${Math.round(delayMs / 1000)}s before next message...`);
                    await this.delay(delayMs);
                }
            }

            // Delay between batches (except for the last one)
            if (batchIndex < batches.length - 1) {
                console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                await this.delay(DELAY_BETWEEN_BATCHES);
            }
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        const result = {
            batchId,
            success: true,
            total,
            sent,
            failed,
            failedRecipients,
            duration,
            messagesPerSecond: Math.round(total / duration * 10) / 10
        };

        console.log(`✅ Bulk send ${batchId} complete: ${sent}/${total} sent in ${duration}s`);

        // Update stored batch info
        this.activeBatches.set(batchId, {
            status: 'completed',
            ...result
        });

        // Clean up after 5 minutes
        setTimeout(() => {
            this.activeBatches.delete(batchId);
        }, 5 * 60 * 1000);

        if (onComplete) {
            onComplete(result);
        }

        return result;
    }

    /**
     * Get status of a batch
     */
    getBatchStatus(batchId) {
        return this.activeBatches.get(batchId) || null;
    }

    /**
     * Cancel a batch (not implemented - would require AbortController)
     */
    cancelBatch(batchId) {
        const batch = this.activeBatches.get(batchId);
        if (batch) {
            batch.status = 'cancelled';
            return true;
        }
        return false;
    }

    /**
     * Split array into chunks
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Get a random delay between min and max milliseconds
     */
    getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new BulkMessageService();
