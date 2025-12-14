-- Agregar columnas de media a la tabla messages
-- Ejecutar en psql: \i add_media_columns.sql

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS media_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Verificar que se agregaron
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('media_type', 'media_url');

SELECT 'Columnas de media agregadas correctamente!' as resultado;
