const { Pool } = require('pg');
const p = new Pool({connectionString:'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require'});

(async()=>{
    const e = await p.query("SELECT extname FROM pg_extension WHERE extname='vector'");
    console.log('pgvector:', e.rows.length > 0 ? 'YES' : 'NO');

    const c = await p.query("SELECT column_name, udt_name FROM information_schema.columns WHERE table_name='ai_knowledge_global' ORDER BY ordinal_position");
    c.rows.forEach(r => console.log(' ', r.column_name, r.udt_name));

    const s = await p.query("SELECT COUNT(*) as total, COUNT(embedding) as with_emb FROM ai_knowledge_global");
    console.log('Stats:', s.rows[0]);

    await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });
