const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require';

const updateTenant = async () => {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to the database successfully.');

        const query = `
            UPDATE tenants 
            SET whatsapp_provider = 'official',
                wa_phone_number_id = $1,
                wa_access_token = $2,
                wa_verify_token = $3,
                wa_business_account_id = $4
            WHERE slug = 'cali'
            RETURNING id, name, slug, whatsapp_provider, wa_phone_number_id;
        `;
        const values = [
            '1306213805899570',
            'EAAPFLdeDwwgBSHsIIDpfo4HNaKncGDoGtgjHNTlFhVt92VRx6G3q0hGkpnRPd9gnB0FyfKOp4ZCkoJFboDSEf2o7b3FlU5BERQhTH2aEvdvVtPAmVejkOk0djXZCa5DYkO30AjMvGBWtYKj1BoqKUycvmZAp12PmlpLdsIttCeWRPKFoH1j2ZCcP7VoHpwZDZD',
            'larg3_cal1_2026',
            '1314879630723797'
        ];

        const res = await client.query(query, values);
        if (res.rowCount > 0) {
            console.log('Tenant updated successfully:', res.rows[0]);
        } else {
            console.log('No tenant found with slug "cali". Please verify the slug name.');
        }

    } catch (error) {
        console.error('Error updating tenant:', error);
    } finally {
        await client.end();
    }
};

updateTenant();
