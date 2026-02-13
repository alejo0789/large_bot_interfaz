# Endpoints de Evolution API

Basándome en lo que encontramos, aquí están los endpoints relevantes:

## ✅ Endpoints que funcionan:

### 1. `/chat/findChats/{instance}` 
- **Propósito**: Obtener metadata de los chats (conversaciones)
- **Retorna**: Info del chat (id, remoteJid, pushName, lastMessage, unreadCount, etc.)
- **NO retorna**: Lista completa de mensajes históricos

**Campos disponibles en el chat:**
```javascript
{
  id,
  remoteJid,
  pushName,
  profilePicUrl,
  updatedAt,
  windowStart,
  windowExpires,
  windowActive,
  lastMessage,    // Solo el ÚLTIMO mensaje
  unreadCount,
  isSaved
}
```

## ❓ Endpoint necesario: Obtener Mensajes Históricos

Para obtener el historial completo de mensajes, probablemente necesites uno de estos:

1. `/message/find/{instance}` - POST con filtros
2. `/message/findByRemoteJid/{instance}` - GET/POST
3. `/chat/findMessages/{instance}` - POST
4. `/message/list/{instance}/{remoteJid}` - GET

**¿Puedes verificar en la documentación de tu Evolution API cuál es el endpoint correcto?**

Accede a: `https://evolution-api-production-8e62.up.railway.app/api-docs`

Busca endpoints relacionados con "message" y "find" o "fetch".
