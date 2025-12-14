-- Test Data for Chatbot Platform (UTF-8)
SET client_encoding = 'UTF8';

DELETE FROM messages;
DELETE FROM conversation_tags;
DELETE FROM conversations;

INSERT INTO conversations (phone, contact_name, ai_enabled, status, unread_count, last_message_text, last_message_timestamp, created_at, updated_at)
VALUES 
  ('+573001234567', 'Maria Garcia Pena', true, 'active', 3, 'Hola, como estan hoy?', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 days', NOW()),
  ('+573005551234', 'Ana Maria Martinez', true, 'active', 1, 'Gracias por la informacion', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '3 hours', NOW()),
  ('+573001112233', 'Laura Rodriguez Munoz', false, 'active', 5, 'Tienen disponibilidad para manana?', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '1 week', NOW()),
  ('+573008889999', 'Jose Nono Perez', true, 'active', 2, 'El senor Penaloza esta disponible?', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 day', NOW()),
  ('+573009876543', 'Carlos Lopez Ordonez', false, 'active', 0, 'A que hora abren manana?', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day', NOW()),
  ('+573007778899', 'Pedro Sanchez Ibanez', true, 'active', 0, 'Perfecto, nos vemos manana', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '5 hours', NOW()),
  ('+573006665544', 'Lucia Fernandez Avila', true, 'active', 0, 'Excelente atencion, muchas gracias', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 days', NOW()),
  ('+573003332211', 'Andres Pineiro Castano', false, 'active', 0, 'Ya realice el pago, quedo atento', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (phone) DO UPDATE SET
  contact_name = EXCLUDED.contact_name,
  unread_count = EXCLUDED.unread_count,
  last_message_text = EXCLUDED.last_message_text,
  last_message_timestamp = EXCLUDED.last_message_timestamp,
  updated_at = NOW();

INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573001234567', 'user', 'Hola, buenas tardes', 'delivered', NOW() - INTERVAL '2 days'),
  ('+573001234567', 'bot', 'Hola Maria! Bienvenida. En que puedo ayudarte?', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '1 minute'),
  ('+573001234567', 'user', 'Quiero saber sobre sus servicios', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573001234567', 'bot', 'Con gusto te cuento. Ofrecemos diseno grafico y web.', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '30 seconds'),
  ('+573001234567', 'user', 'Hola, como estan hoy?', 'delivered', NOW() - INTERVAL '5 minutes');

INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573009876543', 'user', 'Buenos dias', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573009876543', 'agent', 'Hola Carlos! En que te puedo ayudar?', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '2 minutes'),
  ('+573009876543', 'user', 'A que hora abren manana?', 'delivered', NOW() - INTERVAL '1 hour');

INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573005551234', 'user', 'Cuales son los precios?', 'delivered', NOW() - INTERVAL '3 hours'),
  ('+573005551234', 'bot', 'Nuestros planes empiezan desde 50000 mensuales', 'delivered', NOW() - INTERVAL '3 hours' + INTERVAL '10 seconds'),
  ('+573005551234', 'user', 'Tienen plan empresarial?', 'delivered', NOW() - INTERVAL '2 hours'),
  ('+573005551234', 'bot', 'Si, tenemos planes especiales para empresas.', 'delivered', NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds'),
  ('+573005551234', 'user', 'Gracias por la informacion', 'delivered', NOW() - INTERVAL '30 minutes');

INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573007778899', 'user', 'Necesito agendar una cita', 'delivered', NOW() - INTERVAL '5 hours'),
  ('+573007778899', 'bot', 'Para cuando te gustaria la cita?', 'delivered', NOW() - INTERVAL '5 hours' + INTERVAL '15 seconds'),
  ('+573007778899', 'user', 'Manana a las 3pm', 'delivered', NOW() - INTERVAL '3 hours'),
  ('+573007778899', 'agent', 'Listo Pedro, tu cita esta agendada para manana a las 3pm', 'delivered', NOW() - INTERVAL '3 hours' + INTERVAL '1 minute'),
  ('+573007778899', 'user', 'Perfecto, nos vemos manana', 'delivered', NOW() - INTERVAL '2 hours');

INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573001112233', 'user', 'Hola, buen dia', 'delivered', NOW() - INTERVAL '1 week'),
  ('+573001112233', 'bot', 'Hola Laura! Como te puedo ayudar?', 'delivered', NOW() - INTERVAL '1 week' + INTERVAL '5 seconds'),
  ('+573001112233', 'user', 'Quiero informacion', 'delivered', NOW() - INTERVAL '6 days'),
  ('+573001112233', 'user', 'Siguen ahi?', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573001112233', 'user', 'Tienen disponibilidad para manana?', 'delivered', NOW() - INTERVAL '10 minutes');

SELECT 'Datos insertados correctamente' as resultado;
SELECT COUNT(*) as total_conversations FROM conversations;
SELECT COUNT(*) as total_messages FROM messages;