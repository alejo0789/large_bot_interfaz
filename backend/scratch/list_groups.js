const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function listGroups() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const instance = 'large_cali';

    try {
        console.log(`Listing groups for instance: ${instance}`);
        const response = await fetch(`${baseUrl}/group/fetchAllGroups/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        console.log('Groups count:', data.length);
        const equipoCali = data.find(g => g.subject && g.subject.includes('Equipo Cali'));
        if (equipoCali) {
            console.log('Found Equipo Cali:', equipoCali);
        } else {
            console.log('Equipo Cali NOT FOUND in groups list.');
            // Print first 5 groups to see what's there
            console.log('First 5 groups:', data.slice(0, 5).map(g => g.subject));
        }
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

listGroups();
