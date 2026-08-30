const { Client } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require';
const valleduparUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/valledupar_paula?sslmode=require&channel_binding=require';

async function syncAgent() {
  const masterClient = new Client({ connectionString: masterUrl });
  const valleduparClient = new Client({ connectionString: valleduparUrl });
  
  await masterClient.connect();
  await valleduparClient.connect();
  
  try {
    const user = await masterClient.query("SELECT id::text, username, password_hash, full_name as name, email, is_active FROM users WHERE username = 'paula.arjona'");
    
    if (user.rows.length > 0) {
      const agent = user.rows[0];
      await valleduparClient.query(`
        INSERT INTO agents (id, username, password_hash, name, email, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (username) DO UPDATE SET
            id = EXCLUDED.id,
            password_hash = EXCLUDED.password_hash,
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            is_active = EXCLUDED.is_active;
      `, [agent.id, agent.username, agent.password_hash, agent.name, agent.email, agent.is_active]);
      console.log("Successfully synced Paula Arjona to Valledupar agents table.");
    } else {
      console.log("User not found in master.");
    }
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    await masterClient.end();
    await valleduparClient.end();
  }
}

syncAgent().catch(console.error);
