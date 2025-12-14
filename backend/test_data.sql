-- Test Data for Chatbot Platform
-- Run this file: psql -U postgres -d chatbot_db -f test_data.sql

-- Configurar encoding UTF-8 para caracteres especiales (ñ, tildes)
SET client_encoding = 'UTF8';

-- Limpiar datos existentes
DELETE FROM messages;
DELETE FROM conversation_tags;
DELETE FROM conversations;

-- Resetear secuencias si existen
-- ALTER SEQUENCE conversations_id_seq RESTART WITH 1;
-- ALTER SEQUENCE messages_id_seq RESTART WITH 1;

-- Insert test conversations con caracteres especiales (ñ, tildes)
-- Algunas con mensajes no leídos, otras leídas
INSERT INTO conversations (phone, contact_name, ai_enabled, status, unread_count, last_message_text, last_message_timestamp, created_at, updated_at)
VALUES 
  -- Conversaciones con mensajes NO LEÍDOS
  ('+573001234567', 'María García Peña', true, 'active', 3, '¡Hola! ¿Cómo están hoy?', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 days', NOW()),
  ('+573005551234', 'Ana María Martínez', true, 'active', 1, 'Gracias por la información, ¿cuándo podría agendar?', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '3 hours', NOW()),
  ('+573001112233', 'Laura Rodríguez Muñoz', false, 'active', 5, '¿Tienen disponibilidad para mañana?', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '1 week', NOW()),
  ('+573008889999', 'José Ñoño Pérez', true, 'active', 2, '¿El señor Peñaloza está disponible?', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 day', NOW()),
  
  -- Conversaciones LEÍDAS (unread_count = 0)
  ('+573009876543', 'Carlos López Ordóñez', false, 'active', 0, '¿A qué hora abren mañana?', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day', NOW()),
  ('+573007778899', 'Pedro Sánchez Ibáñez', true, 'active', 0, 'Perfecto, nos vemos mañana en la reunión', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '5 hours', NOW()),
  ('+573006665544', 'Lucía Fernández Ávila', true, 'active', 0, 'Excelente atención, muchas gracias', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 days', NOW()),
  ('+573003332211', 'Andrés Piñeiro Castaño', false, 'active', 0, 'Ya realicé el pago, quedo atento', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (phone) DO UPDATE SET
  contact_name = EXCLUDED.contact_name,
  unread_count = EXCLUDED.unread_count,
  last_message_text = EXCLUDED.last_message_text,
  last_message_timestamp = EXCLUDED.last_message_timestamp,
  updated_at = NOW();

-- Insert test messages para María García Peña (NO LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573001234567', 'user', 'Hola, buenas tardes señor', 'delivered', NOW() - INTERVAL '2 days'),
  ('+573001234567', 'bot', '¡Hola María! Bienvenida a nuestro servicio. ¿En qué puedo ayudarte hoy?', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '1 minute'),
  ('+573001234567', 'user', 'Quiero saber sobre sus servicios de diseño', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573001234567', 'bot', 'Con gusto te cuento. Ofrecemos diseño gráfico, web y más. ¿Cuál te interesa?', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '30 seconds'),
  ('+573001234567', 'user', '¡Hola! ¿Cómo están hoy?', 'delivered', NOW() - INTERVAL '5 minutes');

-- Insert test messages para Carlos López Ordóñez (LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573009876543', 'user', 'Buenos días, ¿cómo están?', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573009876543', 'agent', 'Hola Carlos, ¡muy bien! ¿En qué te puedo ayudar?', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '2 minutes'),
  ('+573009876543', 'user', '¿A qué hora abren mañana?', 'delivered', NOW() - INTERVAL '1 hour');

-- Insert test messages para Ana María Martínez (NO LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573005551234', 'user', '¿Cuáles son los precios del año?', 'delivered', NOW() - INTERVAL '3 hours'),
  ('+573005551234', 'bot', 'Nuestros planes empiezan desde $50.000 mensuales. ¡Súper económico!', 'delivered', NOW() - INTERVAL '3 hours' + INTERVAL '10 seconds'),
  ('+573005551234', 'user', '¿Tienen plan empresarial con señal rápida?', 'delivered', NOW() - INTERVAL '2 hours'),
  ('+573005551234', 'bot', 'Sí, tenemos planes especiales para empresas pequeñas y grandes. ¿Te envío más información?', 'delivered', NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds'),
  ('+573005551234', 'user', 'Gracias por la información, ¿cuándo podría agendar?', 'delivered', NOW() - INTERVAL '30 minutes');

-- Insert test messages para Pedro Sánchez Ibáñez (LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573007778899', 'user', 'Necesito agendar una cita con el señor Peñaloza', 'delivered', NOW() - INTERVAL '5 hours'),
  ('+573007778899', 'bot', '¿Para cuándo te gustaría la cita? Tenemos disponibilidad mañana.', 'delivered', NOW() - INTERVAL '5 hours' + INTERVAL '15 seconds'),
  ('+573007778899', 'user', 'Mañana a las 3pm estaría genial', 'delivered', NOW() - INTERVAL '3 hours'),
  ('+573007778899', 'agent', 'Listo Pedro, tu cita está agendada para mañana a las 3pm. ¡Excelente!', 'delivered', NOW() - INTERVAL '3 hours' + INTERVAL '1 minute'),
  ('+573007778899', 'user', 'Perfecto, nos vemos mañana en la reunión', 'delivered', NOW() - INTERVAL '2 hours');

-- Insert test messages para Laura Rodríguez Muñoz (NO LEÍDOS - muchos)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573001112233', 'user', '¡Hola! Buen día', 'delivered', NOW() - INTERVAL '1 week'),
  ('+573001112233', 'bot', '¡Hola Laura! ¿Cómo te puedo ayudar hoy?', 'delivered', NOW() - INTERVAL '1 week' + INTERVAL '5 seconds'),
  ('+573001112233', 'user', 'Quiero información sobre el señor Ordóñez', 'delivered', NOW() - INTERVAL '6 days'),
  ('+573001112233', 'user', '¿Siguen ahí? Es urgente', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573001112233', 'user', '¿Tienen disponibilidad para mañana?', 'delivered', NOW() - INTERVAL '10 minutes');

-- Insert test messages para José Ñoño Pérez (NO LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573008889999', 'user', 'Buenas tardes, soy José Ñoño', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573008889999', 'bot', '¡Hola José! Bienvenido. ¿En qué puedo asistirte?', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '10 seconds'),
  ('+573008889999', 'user', '¿El señor Peñaloza está disponible?', 'delivered', NOW() - INTERVAL '15 minutes');

-- Insert test messages para Lucía Fernández Ávila (LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573006665544', 'user', 'Hola, acabo de recibir mi pedido número 12345', 'delivered', NOW() - INTERVAL '2 days'),
  ('+573006665544', 'agent', '¡Qué alegría Lucía! ¿Todo llegó en buen estado?', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
  ('+573006665544', 'user', 'Sí, perfectamente. Muy rápido el envío', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
  ('+573006665544', 'user', 'Excelente atención, muchas gracias', 'delivered', NOW() - INTERVAL '4 hours');

-- Insert test messages para Andrés Piñeiro Castaño (LEÍDOS)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp)
VALUES
  ('+573003332211', 'user', 'Buenos días, quiero hacer un pago', 'delivered', NOW() - INTERVAL '3 days'),
  ('+573003332211', 'bot', 'Claro Andrés. Puedes pagar a la cuenta Bancolombia o Nequi.', 'delivered', NOW() - INTERVAL '3 days' + INTERVAL '20 seconds'),
  ('+573003332211', 'user', '¿El número de cuenta cuál es?', 'delivered', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes'),
  ('+573003332211', 'agent', 'El número es 123-456789-00 a nombre de Compañía XYZ S.A.S.', 'delivered', NOW() - INTERVAL '3 days' + INTERVAL '10 minutes'),
  ('+573003332211', 'user', 'Ya realicé el pago, quedo atento', 'delivered', NOW() - INTERVAL '6 hours');

-- Actualizar timestamps basados en el último mensaje
UPDATE conversations SET 
  last_message_timestamp = (
    SELECT MAX(timestamp) 
    FROM messages 
    WHERE messages.conversation_phone = conversations.phone
  )
WHERE phone IN (
  '+573001234567', '+573009876543', '+573005551234', 
  '+573007778899', '+573001112233', '+573008889999',
  '+573006665544', '+573003332211'
);

-- Mostrar resultados
SELECT '✅ Datos de prueba insertados correctamente!' as resultado;
SELECT 'Conversaciones:' as info, COUNT(*) as total, SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as no_leidas, SUM(CASE WHEN unread_count = 0 THEN 1 ELSE 0 END) as leidas FROM conversations;
SELECT 'Mensajes:' as info, COUNT(*) as total FROM messages;
