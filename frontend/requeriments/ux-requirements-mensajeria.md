# Requerimientos UX/HCI — App de Mensajería (estilo WhatsApp)

> Documento de referencia para el diseño e implementación de una aplicación de mensajería fluida, intuitiva y visualmente atractiva en React.

---

## 🧭 Navegación y Gestos

### Swipe Back (requerimiento principal)
- Swipe horizontal (derecha) para volver atrás en cualquier pantalla, con animación que **sigue el dedo en tiempo real** — no espera a soltar
- Umbral de activación: **30–40% del ancho de pantalla** para confirmar el gesto
- Feedback háptico suave al confirmar el gesto de retroceso
- Implementación sugerida: `@use-gesture/react` + `Framer Motion`

### Transiciones entre Pantallas
- Usar **shared element transitions**: el avatar del contacto "vuela" desde la lista hasta el header de la conversación
- Duración ideal: **280–320ms** con easing `ease-in-out`
- En React: `Framer Motion` con `layoutId` para animar elementos compartidos
- Nunca animar `height`, `top` o `margin` — solo `transform` y `opacity` para evitar repaints

---

## 🔍 Búsqueda y Contactos

### Problema: al volver atrás queda el texto buscado
- Al navegar hacia la conversación desde búsqueda, la búsqueda debe quedar **"suspendida"**
- Al regresar (gesto o botón), **limpiar automáticamente** el campo y restaurar la lista completa de conversaciones
- Flujo esperado: Buscar → Abrir chat → Swipe back → Ver lista limpia ✅
- El campo de búsqueda debe tener botón **✕ visible** siempre que haya texto
- Búsqueda en tiempo real con **debounce de ~200ms** para no saturar el render

---

## ⌨️ Teclado y Envío de Mensajes

### Enter para enviar (requerimiento)
- En móvil: `Enter` dentro del `textarea` envía el mensaje (sin necesidad de tocar el botón)
- **`Shift + Enter`** inserta salto de línea
- En respuestas rápidas (quick replies): navegar con flechas del teclado, `Enter` para seleccionar y enviar
- El `textarea` debe **auto-expandirse** hasta 5–6 líneas y luego hacer scroll interno, sin desplazar toda la UI

---

## 🖼️ Carga de Imágenes — Fluidez

### Causas del efecto "robótico"
- Mostrar placeholder con tamaño incorrecto hasta que carga → **layout shift** (salto visual)
- Sin efecto de transición ni blur progresivo
- Sin lazy loading fuera del viewport

### Soluciones recomendadas
- El servidor debe enviar `width` y `height` de cada imagen en el payload del mensaje → placeholder con **dimensiones reales desde el inicio**
- Implementar **BlurHash / ThumbHash**: miniatura de 20–30px borrosa que aparece instantáneamente mientras carga la imagen real
- Transición borrosa → nítida con `opacity` + `filter: blur()` animado (~300ms)
- Librerías: `blurhash` + `react-blurhash`
- **Lazy loading** con `Intersection Observer` para no cargar imágenes fuera del viewport

---

## 😄 Reacciones a Mensajes

- **Long press (500ms)** sobre un mensaje abre un picker flotante con 6–8 emojis frecuentes
- El picker aparece con animación `spring` que "sale" del mensaje (no desde una esquina)
- Las reacciones se muestran como **pequeñas burbujas superpuestas** debajo del mensaje, agrupadas si son iguales
- Tap sobre una reacción propia la quita
- Tap sobre una reacción ajena muestra quién reaccionó

---

## 🗑️ Borrar Conversaciones

- **Swipe left** sobre una conversación revela acciones: `Archivar` y `Eliminar` (patrón estándar iOS/Android)
- **Long press** habilita modo selección múltiple para borrar varias a la vez
- Confirmación de borrado con **bottom sheet** o **snackbar con opción "Deshacer"** por 4–5 segundos antes del borrado definitivo
- Evitar borrados irreversibles sin confirmación

---

## 💬 Lista de Conversaciones

- **Scroll virtualizado** con `react-virtuoso` o `react-window` — crítico para mantener 60fps con muchas conversaciones
- Conversaciones no leídas: nombre en **bold** + punto de color (no solo badge numérico)
- Preview del último mensaje: truncado con `...` a 1 línea
- Indicadores de estado del mensaje:
  - ✓ Enviado
  - ✓✓ Entregado
  - ✓✓ (azul) Leído

---

## 🎨 Estética e Interfaz Llamativa

- **Glassmorphism sutil** en el header: fondo borroso translúcido para profundidad visual
- Burbujas de mensaje con **bordes redondeados asimétricos** (más redondo en esquinas alejadas del avatar)
- **Gradiente suave** en el fondo del chat — no blanco plano; un degradado muy sutil de dos tonos neutros
- **Modo oscuro nativo** desde el inicio — definir tokens de color en CSS variables, no como afterthought
- Tipografía recomendada: **Inter** o **Plus Jakarta Sans** — legibles, modernas, buen kerning en tamaños pequeños
- **Micro-interacción del botón enviar**: cambia de ícono (🎤 micrófono → ➤ flecha) al escribir, con animación de escala

---

## ⚡ Performance y Fluidez General

- Usar **CSS `transform` y `opacity`** para todas las animaciones — nunca animar `height`, `top` o `margin`
- `will-change: transform` en elementos que se animarán frecuentemente
- **Optimistic UI**: el mensaje aparece en el chat inmediatamente al enviarlo, sin esperar respuesta del servidor
- **Skeleton screens** en lugar de spinners para la carga inicial de conversaciones
- `requestAnimationFrame` para cualquier animación custom en JS

---

## ♿ Accesibilidad

- Todos los elementos interactivos con mínimo **44×44px de área de toque** (guía Apple HIG y Material Design)
- Contraste mínimo **WCAG AA (4.5:1)** en textos sobre fondos de burbuja
- `aria-label` en íconos sin texto (botón enviar, adjuntar, etc.)
- Soporte para navegación con teclado en todas las funciones principales

---

## 📦 Stack Sugerido para React

| Problema / Necesidad | Librería recomendada |
|---|---|
| Animaciones fluidas, swipe back, transiciones | `Framer Motion` |
| Scroll virtualizado de lista | `react-virtuoso` |
| Blur progresivo de imágenes | `react-blurhash` |
| Gestos táctiles (swipe, long press) | `@use-gesture/react` |
| Bottom sheets y modales | `vaul` (Drawer) |
| Teclado virtual / manejo de focus | `react-focus-lock` |

---

## 📋 Checklist de Criterios de Aceptación

- [ ] Swipe right vuelve atrás con animación que sigue el dedo en tiempo real
- [ ] Al volver de una conversación abierta por búsqueda, el campo se limpia automáticamente
- [ ] Enter envía mensaje; Shift+Enter inserta salto de línea
- [ ] Enter selecciona y envía respuestas rápidas
- [ ] Las imágenes cargan con blur progresivo sin layout shift
- [ ] Long press sobre mensaje abre picker de reacciones con animación spring
- [ ] Swipe left en conversación revela acciones de archivar/eliminar
- [ ] Borrado con opción "Deshacer" por 5 segundos
- [ ] Lista de conversaciones con scroll virtualizado a 60fps
- [ ] Botón de enviar hace transición de micrófono a flecha al escribir
- [ ] Header con efecto glassmorphism
- [ ] Modo oscuro nativo con CSS variables
- [ ] Área de toque mínima 44×44px en todos los controles
- [ ] Contraste WCAG AA en todos los textos
