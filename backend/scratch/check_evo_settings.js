const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkEvolutionSettings() {
    const baseUrl = 'https://evolution.forsa.com.co'; // Based on typical usage in these logs
    const apiKey = 'B6704C62743C452C96A688C114193A71'; // Found in earlier logs/env
    const instance = 'large_cali';

    try {
        const response = await fetch(`${baseUrl}/settings/find/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log(`Settings for ${instance}:`, data);
    } catch (err) {
        console.error(err);
    }
}

checkEvolutionSettings();
