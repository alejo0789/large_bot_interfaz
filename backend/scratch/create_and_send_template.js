const accessToken = 'EAAPFLdeDwwgBSIFKHKUFEilY1MNIU8Aj1gM7iKJKSNw6YfYiKIjPPStjuZCBhxNNZAeZAdjj8STGjbMdN4yQiNpkzWv1nOF45ntQwn7bZB8LEm1EaMzRcN3MjguHjdS6Wf5kifZCt3ruZAuLfalInut2aRyKTi0TvhNH1VXe1esytFhyKyfk2hlLZC3hnOubgZDZD';
const wabaId = '1682900699473236';
const phoneNumberId = '1287169484472642';
const toPhone = '573153404327';

const templateName = 'prueba_conexion_' + Date.now().toString().slice(-4);

const createTemplateUrl = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;

const createTemplateBody = {
    name: templateName,
    category: "UTILITY",
    language: "es",
    components: [
        {
            type: "BODY",
            text: "Hola. Este es un mensaje de prueba para verificar la conexión del sistema a la API Oficial de WhatsApp. ¡Todo está funcionando correctamente!"
        }
    ]
};

async function createAndSend() {
    try {
        console.log(`Creando plantilla: ${templateName}...`);
        const createRes = await fetch(createTemplateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(createTemplateBody)
        });
        
        const createData = await createRes.json();
        console.log('Respuesta de creacion:', createData);
        
        if (createData.error) {
            console.error('No se pudo crear la plantilla.');
            return;
        }

        console.log('Esperando 3 segundos para que Meta propague y apruebe la plantilla...');
        await new Promise(r => setTimeout(r, 3000));
        
        console.log(`Enviando plantilla ${templateName} a ${toPhone}...`);
        
        const sendUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
        const sendBody = {
            messaging_product: 'whatsapp',
            to: toPhone,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: 'es'
                }
            }
        };

        const sendRes = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sendBody)
        });

        const sendData = await sendRes.json();
        console.log('Respuesta de envio:', sendData);
        
    } catch (e) {
        console.error('Error:', e);
    }
}

createAndSend();
