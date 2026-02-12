const { pool } = require('../src/config/database');

async function checkDb() {
    try {
        console.log('--- CHECKING CONVERSATIONS ---');
        const convs = await pool.query('SELECT phone, contact_name, last_message_text FROM conversations');
        convs.rows.forEach(c => {
            console.log(`Phone: [${c.phone}] | Name: [${c.contact_name}] | Last: [${c.last_message_text?.substring(0, 30)}]`);
        });

        console.log('\n--- CHECKING FOR THE WEIRD ID 75978642600014 ---');
        const weird = await pool.query('SELECT * FROM conversations WHERE phone LIKE \'%75978642600014%\'');
        console.log(`Found ${weird.rows.length} matches`);
        weird.rows.forEach(w => console.log(JSON.stringify(w)));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkDb();
