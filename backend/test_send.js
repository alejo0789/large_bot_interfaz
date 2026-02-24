require('dotenv').config();
const { db } = require('./src/config/database');
const evolutionService = require('./src/services/evolutionService');

async function run() {
    const res = await evolutionService.sendText('573001438534', 'Testing evolution service from DB');
    console.log("Evolution API Result:");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
