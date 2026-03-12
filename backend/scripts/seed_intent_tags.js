require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

// We connect specifically to chatbot_master where tags and conversations live
const pool = new Pool({
  connectionString: process.env.MASTER_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log(`Connecting to database at ${process.env.MASTER_DATABASE_URL.split('@')[1]}...`);
  const query = `
    INSERT INTO tags (name, color) VALUES
    ('LID_6H', '#FFB3B3'),
    ('LID_12H', '#FF8080'),
    ('LID_1D', '#FF4D4D'),
    ('LID_2D', '#FF1A1A'),
    ('LID_3D_PLUS', '#E60000'),
    ('LID_INTERESADO', '#4CAF50'),
    ('LID_MEDIO', '#FF9800'),
    ('LID_NO_INTERESADO', '#F44336')
    ON CONFLICT (name) DO NOTHING;
  `;
  try {
    const res = await pool.query(query);
    console.log('✅ Successfully inserted tags! Rows affected:', res.rowCount);
  } catch (err) {
    console.error('❌ Error inserting tags:', err);
  } finally {
    pool.end();
  }
}

run();
