const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function listGroups() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const instance = 'large_cali';

    const endpoints = [
        `/group/fetchAllGroups/${instance}`,
        `/group/findGroups/${instance}`,
        `/group/info/${instance}?groupJid=all`
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Trying ${ep}...`);
            const response = await fetch(`${baseUrl}${ep}`, {
                headers: { 'apikey': apiKey }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Success! Found ${data.length} items.`);
                const found = Array.isArray(data) ? data.find(g => g.subject && g.subject.includes('Equipo Cali')) : null;
                if (found) console.log('Found Equipo Cali:', found);
                else if (Array.isArray(data)) console.log('First 3 subjects:', data.slice(0, 3).map(g => g.subject));
                return;
            } else {
                console.warn(`Failed: ${response.status}`);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
    }
}

listGroups();
