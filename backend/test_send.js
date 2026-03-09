require('dotenv').config();
const { Pool } = require('pg');

async function testSend() {
    const pool = new Pool({ connectionString: process.env.MASTER_DATABASE_URL });
    try {
        const { rows } = await pool.query("SELECT wa_phone_number_id, wa_access_token FROM tenants WHERE slug = 'testoficial'");
        if (rows.length === 0) {
            console.error("No se encontró la sede testoficial");
            process.exit(1);
        }
        const { wa_phone_number_id, wa_access_token } = rows[0];

        console.log(`📡 Enviando mensaje usando Phone_ID: ${wa_phone_number_id}`);

        const response = await fetch(`https://graph.facebook.com/v19.0/${wa_phone_number_id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${wa_access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: '573153404327',
                type: 'text',
                text: { // the text object
                    preview_url: false,
                    body: 'Hola, este es un mensaje enviado por la API Oficial de Meta Cloud!'
                }
            })
        });

        const data = await response.json();
        console.log('✅ Respuesta de Meta:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Error de conexión:', error);
    } finally {
        await pool.end();
    }
}

testSend();
