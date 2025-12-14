-- Test Data con caracteres especiales usando Unicode escapes
SET client_encoding = 'UTF8';

DELETE FROM messages;
DELETE FROM conversation_tags;
DELETE FROM conversations;

-- Usar E'' para escape strings con Unicode
INSERT INTO conversations (phone, contact_name, ai_enabled, status, unread_count, last_message_text, last_message_timestamp, created_at, updated_at)
VALUES 
  ('+573001234567', E'Mar\u00EDa Garc\u00EDa Pe\u00F1a', true, 'active', 3, E'\u00A1Hola! \u00BFC\u00F3mo est\u00E1n hoy?', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 days', NOW()),
  ('+573005551234', E'Ana Mar\u00EDa Mart\u00EDnez', true, 'active', 1, E'Gracias por la informaci\u00F3n', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '3 hours', NOW()),
  ('+573001112233', E'Laura Rodr\u00EDguez Mu\u00F1oz', false, 'active', 5, E'\u00BFTienen disponibilidad para ma\u00F1ana?', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '1 week', NOW()),
  ('+573008889999', E'Jos\u00E9 \u00D1o\u00F1o P\u00E9rez', true, 'active', 2, E'\u00BFEl se\u00F1or Pe\u00F1aloza est\u00E1 disponible?', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 day', NOW()),
  ('+573009876543', E'Carlos L\u00F3pez Ord\u00F3\u00F1ez', false, 'active', 0, E'\u00BFA qu\u00E9 hora abren ma\u00F1ana?', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day', NOW()),
  ('+573007778899', E'Pedro S\u00E1nchez Ib\u00E1\u00F1ez', true, 'active', 0, E'Perfecto, nos vemos ma\u00F1ana', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '5 hours', NOW()),
  ('+573006665544', E'Luc\u00EDa Fern\u00E1ndez \u00C1vila', true, 'active', 0, E'Excelente atenci\u00F3n, muchas gracias', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 days', NOW()),
  ('+573003332211', E'Andr\u00E9s Pi\u00F1eiro Casta\u00F1o', false, 'active', 0, E'Ya realic\u00E9 el pago, quedo atento', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (phone) DO UPDATE SET
  contact_name = EXCLUDED.contact_name,
  unread_count = EXCLUDED.unread_count,
  last_message_text = EXCLUDED.last_message_text,
  last_message_timestamp = EXCLUDED.last_message_timestamp,
  updated_at = NOW();

-- Mensajes para Maria Garcia
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573001234567', 'user', E'Hola, buenas tardes se\u00F1or', 'delivered', NOW() - INTERVAL '2 days'),
  ('+573001234567', 'bot', E'\u00A1Hola Mar\u00EDa! Bienvenida. \u00BFEn qu\u00E9 puedo ayudarte?', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '1 minute'),
  ('+573001234567', 'user', E'Quiero saber sobre sus servicios de dise\u00F1o', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573001234567', 'bot', E'Con gusto te cuento. Ofrecemos dise\u00F1o gr\u00E1fico y web.', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '30 seconds'),
  ('+573001234567', 'user', E'\u00A1Hola! \u00BFC\u00F3mo est\u00E1n hoy?', 'delivered', NOW() - INTERVAL '5 minutes');

-- Mensajes para Carlos Lopez
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573009876543', 'user', E'Buenos d\u00EDas, \u00BFc\u00F3mo est\u00E1n?', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573009876543', 'agent', E'Hola Carlos, \u00A1muy bien! \u00BFEn qu\u00E9 te puedo ayudar?', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '2 minutes'),
  ('+573009876543', 'user', E'\u00BFA qu\u00E9 hora abren ma\u00F1ana?', 'delivered', NOW() - INTERVAL '1 hour');

-- Mensajes para Ana Maria
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573005551234', 'user', E'\u00BFCu\u00E1les son los precios del a\u00F1o?', 'delivered', NOW() - INTERVAL '3 hours'),
  ('+573005551234', 'bot', E'Nuestros planes empiezan desde .000. \u00A1S\u00FAper econ\u00F3mico!', 'delivered', NOW() - INTERVAL '3 hours' + INTERVAL '10 seconds'),
  ('+573005551234', 'user', E'\u00BFTienen plan empresarial con se\u00F1al r\u00E1pida?', 'delivered', NOW() - INTERVAL '2 hours'),
  ('+573005551234', 'bot', E'S\u00ED, tenemos planes especiales para empresas peque\u00F1as y grandes.', 'delivered', NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds'),
  ('+573005551234', 'user', E'Gracias por la informaci\u00F3n', 'delivered', NOW() - INTERVAL '30 minutes');

-- Mensajes para Pedro Sanchez
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573007778899', 'user', E'Necesito agendar una cita con el se\u00F1or Pe\u00F1aloza', 'delivered', NOW() - INTERVAL '5 hours'),
  ('+573007778899', 'bot', E'\u00BFPara cu\u00E1ndo te gustar\u00EDa la cita? Tenemos disponibilidad ma\u00F1ana.', 'delivered', NOW() - INTERVAL '5 hours' + INTERVAL '15 seconds'),
  ('+573007778899', 'user', E'Ma\u00F1ana a las 3pm estar\u00EDa genial', 'delivered', NOW() - INTERVAL '3 hours'),
  ('+573007778899', 'agent', E'Listo Pedro, tu cita est\u00E1 agendada para ma\u00F1ana a las 3pm. \u00A1Excelente!', 'delivered', NOW() - INTERVAL '3 hours' + INTERVAL '1 minute'),
  ('+573007778899', 'user', E'Perfecto, nos vemos ma\u00F1ana', 'delivered', NOW() - INTERVAL '2 hours');

-- Mensajes para Laura Rodriguez (muchos no leidos)
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573001112233', 'user', E'\u00A1Hola! Buen d\u00EDa', 'delivered', NOW() - INTERVAL '1 week'),
  ('+573001112233', 'bot', E'\u00A1Hola Laura! \u00BFC\u00F3mo te puedo ayudar hoy?', 'delivered', NOW() - INTERVAL '1 week' + INTERVAL '5 seconds'),
  ('+573001112233', 'user', E'Quiero informaci\u00F3n sobre el se\u00F1or Ord\u00F3\u00F1ez', 'delivered', NOW() - INTERVAL '6 days'),
  ('+573001112233', 'user', E'\u00BFSiguen ah\u00ED? Es urgente', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573001112233', 'user', E'\u00BFTienen disponibilidad para ma\u00F1ana?', 'delivered', NOW() - INTERVAL '10 minutes');

-- Mensajes para Jose Nono
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573008889999', 'user', E'Buenas tardes, soy Jos\u00E9 \u00D1o\u00F1o', 'delivered', NOW() - INTERVAL '1 day'),
  ('+573008889999', 'bot', E'\u00A1Hola Jos\u00E9! Bienvenido. \u00BFEn qu\u00E9 puedo asistirte?', 'delivered', NOW() - INTERVAL '1 day' + INTERVAL '10 seconds'),
  ('+573008889999', 'user', E'\u00BFEl se\u00F1or Pe\u00F1aloza est\u00E1 disponible?', 'delivered', NOW() - INTERVAL '15 minutes');

-- Mensajes para Lucia Fernandez
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573006665544', 'user', E'Hola, acabo de recibir mi pedido n\u00FAmero 12345', 'delivered', NOW() - INTERVAL '2 days'),
  ('+573006665544', 'agent', E'\u00A1Qu\u00E9 alegr\u00EDa Luc\u00EDa! \u00BFTodo lleg\u00F3 en buen estado?', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
  ('+573006665544', 'user', E'S\u00ED, perfectamente. Muy r\u00E1pido el env\u00EDo', 'delivered', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
  ('+573006665544', 'user', E'Excelente atenci\u00F3n, muchas gracias', 'delivered', NOW() - INTERVAL '4 hours');

-- Mensajes para Andres Pineiro
INSERT INTO messages (conversation_phone, sender, text_content, status, timestamp) VALUES
  ('+573003332211', 'user', E'Buenos d\u00EDas, quiero hacer un pago', 'delivered', NOW() - INTERVAL '3 days'),
  ('+573003332211', 'bot', E'Claro Andr\u00E9s. Puedes pagar a la cuenta Bancolombia o Nequi.', 'delivered', NOW() - INTERVAL '3 days' + INTERVAL '20 seconds'),
  ('+573003332211', 'user', E'\u00BFEl n\u00FAmero de cuenta cu\u00E1l es?', 'delivered', NOW() - INTERVAL '3 days' + INTERVAL '5 minutes'),
  ('+573003332211', 'agent', E'El n\u00FAmero es 123-456789-00 a nombre de Compa\u00F1\u00EDa XYZ S.A.S.', 'delivered', NOW() - INTERVAL '3 days' + INTERVAL '10 minutes'),
  ('+573003332211', 'user', E'Ya realic\u00E9 el pago, quedo atento', 'delivered', NOW() - INTERVAL '6 hours');

SELECT 'Datos con caracteres especiales insertados!' as resultado;
SELECT contact_name FROM conversations;