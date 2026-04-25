const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkGroupInfo() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const instance = 'large_cali';
    const jid = '120363422096835125@g.us';

    try {
        console.log(`Checking group info for ${jid}...`);
        const response = await fetch(`${baseUrl}/group/findGroup/${instance}?groupJid=${jid}`, {
            headers: { 'apikey': apiKey }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Group Info:', data);
        } else {
            console.warn(`Failed: ${response.status}`);
            const text = await response.text();
            console.log('Response:', text);
        }
    } catch (err) {
        console.error(err);
    }
}

checkGroupInfo();
