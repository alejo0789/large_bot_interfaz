require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../src/config/database');
const { updateTimeTags } = require('../src/jobs/timeTrackerJob');

async function test() {
    try {
        console.log('Testing time wrapper background job locally...');
        await updateTimeTags();
    } catch (e) {
        console.error('Job failed:', e);
    } finally {
        pool.end();
        console.log('Test completed.');
    }
}

test();
