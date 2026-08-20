const accessToken = 'EAAPFLdeDwwgBSIFKHKUFEilY1MNIU8Aj1gM7iKJKSNw6YfYiKIjPPStjuZCBhxNNZAeZAdjj8STGjbMdN4yQiNpkzWv1nOF45ntQwn7bZB8LEm1EaMzRcN3MjguHjdS6Wf5kifZCt3ruZAuLfalInut2aRyKTi0TvhNH1VXe1esytFhyKyfk2hlLZC3hnOubgZDZD';
const phoneNumberId = '1287169484472642';
const toPhone = '573153404327';

const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

const body = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
        name: 'hello_world',
        language: {
            code: 'en_US'
        }
    }
};

fetch(url, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
})
.then(res => res.json())
.then(data => {
    console.log('Response from Meta:');
    console.log(JSON.stringify(data, null, 2));
})
.catch(err => {
    console.error('Error sending template:', err);
});
