const { Client } = require('pg');

async function addTempId() {
  const valleduparUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/valledupar_paula?sslmode=require&channel_binding=require';
  const client = new Client({ connectionString: valleduparUrl });
  
  await client.connect();
  try {
    await client.query("ALTER TABLE messages ADD COLUMN temp_id text");
    console.log("Successfully added temp_id column to valledupar_paula db.");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await client.end();
  }
}

addTempId().catch(console.error);
