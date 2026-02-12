const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkApi() {
    try {
        const res = await fetch('http://localhost:4000/api/conversations');
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkApi();
