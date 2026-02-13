# Importar Mensajes Históricos desde Evolution API

Este script importa mensajes históricos desde Evolution API a la base de datos local.

## 📋 Requisitos Previos

1. Asegúrate de tener las variables de entorno configuradas en `.env`:
   - `EVOLUTION_API_URL`
   - `EVOLUTION_API_KEY`
   - `EVOLUTION_INSTANCE`

2. La base de datos debe tener conversaciones ya creadas (tabla `conversations`)

## 🚀 Uso

### Importar todas las conversaciones

```bash
node scripts/import-historical-messages.js
```

### Importar solo las primeras 10 conversaciones (para prueba)

```bash
node scripts/import-historical-messages.js --limit=10
```

### Importar solo una conversación específica

```bash
node scripts/import-historical-messages.js --phone=573148063253
```

### Combinar opciones

```bash
node scripts/import-historical-messages.js --phone=573148063253
```

## ⚙️ Configuración

Puedes ajustar estas constantes en el script:

- `BATCH_SIZE`: Número de conversaciones a procesar simultáneamente (default: 10)
- `MESSAGES_PER_CONVERSATION`: Número de mensajes históricos a traer por conversación (default: 100)

## 📊 Salida Esperada

```
🚀 Starting Historical Messages Import
=====================================
Evolution API: https://evolution-api-production-8e62.up.railway.app
Instance: large_cali
Limit: 10 conversations
=====================================

📊 Found 10 conversations to process

📦 Processing batch 1/1

📞 Processing Juan Pérez (573148063253)
  📡 Fetching messages from Evolution API for 573148063253...
  ✅ Found 45 messages for 573148063253
  ✅ Imported 45/45 messages

📞 Processing María García (573187566540)
  📡 Fetching messages from Evolution API for 573187566540...
  ✅ Found 32 messages for 573187566540
  ✅ Imported 32/32 messages

...

=====================================
✅ IMPORT COMPLETED
=====================================
Total conversations processed: 10
Conversations with messages: 8
Total messages imported: 234
=====================================
```

## 🔧 Solución de Problemas

### Error: "No messages returned"

Esto significa que la Evolution API no tiene mensajes para esa conversación. Posibles causas:
- El número no tiene historial
- El formato del número es incorrecto
- La instancia de Evolution API no tiene acceso a esos mensajes

### Error 401: "Unauthorized"

Verifica que tu `EVOLUTION_API_KEY` sea correcta.

### Error 404: "Not Found"

El endpoint de la Evolution API puede ser diferente según la versión. Verifica la documentación de tu Evolution API.

## 📝 Notas

- El script **evita duplicados** automáticamente usando `whatsapp_id`
- Los mensajes se importan del **más reciente al más antiguo**
- El script actualiza automáticamente `last_message` en la tabla `conversations`
- Procesa conversaciones en **lotes** para no saturar la API

## 🔄 Endpoints Alternativos de Evolution API

Si el endpoint por defecto no funciona, prueba estos alternativos en el script:

### Opción 1 (actual):
```javascript
const url = `${EVOLUTION_API_URL}/message/findMessages/${EVOLUTION_INSTANCE}`;
```

### Opción 2:
```javascript
const url = `${EVOLUTION_API_URL}/chat/findMessages/${EVOLUTION_INSTANCE}`;
```

### Opción 3:
```javascript
const url = `${EVOLUTION_API_URL}/message/sync/${EVOLUTION_INSTANCE}`;
```

Consulta la documentación de tu Evolution API en: `https://tu-evolution-api.com/api-docs`
