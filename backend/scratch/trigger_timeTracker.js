require('dotenv').config();
const { updateTimeTags } = require('./src/jobs/timeTrackerJob');

async function test() {
  await updateTimeTags();
  console.log('Done test');
  process.exit(0);
}

test();
