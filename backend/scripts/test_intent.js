require('dotenv').config();
const { pool } = require('../src/config/database');
const tagService = require('../src/services/tagService');
const conversationService = require('../src/services/conversationService');

async function testIntent() {
    const testPhone = '573001234567';
    console.log(`Starting intent tag test on phone: ${testPhone}`);

    try {
        // 1. Ensure conversation exists
        await conversationService.upsert(testPhone, 'Test User');
        console.log('✅ Conversation ensured');

        // 2. Add an intent tag
        console.log('Applying LID_INTERESADO...');
        let success = await tagService.updateIntentTag(testPhone, 'LID_INTERESADO');
        console.log('Success:', success);

        // Fetch to verify
        let tags = await tagService.getByConversation(testPhone);
        console.log('Current Tags:', tags.map(t => t.name));

        // 3. Change intent tag (should replace previous)
        console.log('Changing to LID_MEDIO...');
        success = await tagService.updateIntentTag(testPhone, 'LID_MEDIO');
        console.log('Success:', success);

        // Fetch to verify
        tags = await tagService.getByConversation(testPhone);
        console.log('Current Tags:', tags.map(t => t.name));

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        pool.end();
    }
}

testIntent();
