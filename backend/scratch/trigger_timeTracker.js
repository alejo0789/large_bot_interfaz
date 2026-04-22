require('dotenv').config();
const { updateTimeTags } = require('../src/jobs/timeTrackerJob');

console.log('🚀 Triggering time tracker job manually...');
updateTimeTags().then(() => {
    console.log('✅ Job completed. Check the output above for corrections made.');
    process.exit(0);
}).catch(err => {
    console.error('❌ Job failed:', err);
    process.exit(1);
});
