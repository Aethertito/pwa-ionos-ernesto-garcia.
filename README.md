# Task Manager PWA

**Autor:** Ernesto Garcia Valenzuela
**Materia:** Desarrollo Web Profesional — Universidad Tecnológica de Tijuana
**Docente:** Mike Cardona (@mikecardona076)

**Demo:** https://198.71.54.179.nip.io
**Repo:** https://github.com/Aethertito/pwa-ionos-ernesto-garcia.

---

## Stack

React 18 · TypeScript 5 · Vite 5 · Nginx · Docker · Let's Encrypt

---

## Parte 1: Investigación Teórica

### Web App Manifest (`manifest.json`)

El `manifest.json` es un archivo JSON que proporciona al navegador los metadatos necesarios para tratar la aplicación web como una app instalable. Es el punto de entrada para que el SO reconozca la PWA y la integre en el dispositivo igual que una app nativa.

- **`theme_color`** — Define el color que el sistema operativo aplica a la barra de estado del dispositivo y a la barra de título de la ventana cuando la app está en uso. Debe coincidir con la meta etiqueta `<meta name="theme-color">` en el HTML para que el color sea consistente desde que el usuario entra al sitio hasta que lo instala.

- **`background_color`** — Establece el color de fondo de la splash screen, la pantalla de bienvenida que el SO muestra automáticamente mientras la app carga después de ser lanzada desde el ícono. Idealmente debe ser el mismo color de fondo de la app para evitar un parpadeo visual al arrancar.

- **`display: standalone`** — Controla el modo de presentación de la app. Con `standalone` la app se ejecuta en su propia ventana sin la barra de dirección ni los controles del navegador, dando una experiencia idéntica a una app nativa. Con `browser` se abre como una pestaña más del navegador, perdiendo toda la apariencia de app instalada. Existen también `minimal-ui` (conserva botones mínimos de navegación) y `fullscreen` (ocupa toda la pantalla, para juegos o apps de video).

- **Array de `icons`** — Es el requisito más crítico para la instalabilidad. Chrome requiere al menos un ícono PNG de **192×192** y otro de **512×512** para habilitar el install prompt. El sistema operativo usa estos íconos en el lanzador de apps, la splash screen, el dock y la pantalla de inicio del dispositivo. La propiedad `purpose: "maskable"` permite que el SO aplique su propia forma de máscara (círculo, squircle, etc.) al ícono sin recortar contenido importante.

### Service Workers

Un Service Worker es un script JavaScript que corre en un **hilo separado** al hilo principal del navegador. Al no tener acceso al DOM, su función es otra: actúa como un **proxy de red del lado del cliente**, posicionándose entre la aplicación y la red para interceptar todas las peticiones HTTP que hace la app y decidir cómo responderlas — desde el caché, desde la red, o con una combinación de ambas.

Esto es lo que le da a una PWA su capacidad offline: si no hay red, el SW puede seguir sirviendo los recursos que tenga en caché sin que el usuario note diferencia.

**Registro** — Se hace desde el hilo principal de la app, generalmente en el punto de entrada:
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
```
Se verifica soporte del navegador, se espera al evento `load` para no bloquear la carga inicial, y se indica la ruta del archivo del SW. El `scope` por defecto es el directorio donde está `sw.js`.

**Ciclo de vida:**

1. **Install** — Primer evento que se dispara cuando el navegador descarga el SW por primera vez (o detecta una nueva versión). Aquí se abre un cache y se pre-cachean los recursos esenciales del shell de la app con `caches.addAll()`. Se llama `self.skipWaiting()` para que el SW pase directo a activarse sin esperar a que se cierren las pestañas existentes.

2. **Activate** — El SW toma el control. En este evento se limpian los caches de versiones anteriores para no acumular datos obsoletos. Se llama `self.clients.claim()` para que el SW empiece a controlar las pestañas ya abiertas sin necesidad de que el usuario recargue la página.

3. **Fetch** — Evento continuo: se dispara cada vez que la app realiza una petición de red. El SW la intercepta con `event.respondWith()` y aplica la estrategia de caché definida según el tipo de recurso solicitado.

### Estrategias de Caché

La estrategia de caché define cómo el SW balancea velocidad de respuesta, frescura de datos y disponibilidad offline. Elegir la correcta para cada tipo de recurso es clave para una buena experiencia de usuario.

**Cache First** — Busca el recurso en caché primero. Solo hace petición a la red si no existe en caché, y guarda el resultado para la próxima vez. Prioriza velocidad máxima y funcionamiento offline. Ideal para assets estáticos como JS, CSS, fuentes e imágenes que no cambian frecuentemente (Vite les añade un hash al nombre, por lo que un archivo nuevo nunca colisiona con el caché viejo).

**Network First** — Intenta siempre obtener el recurso de la red primero, guardándolo en caché como respaldo. Solo recurre al caché si la petición falla por falta de conexión. Prioriza tener datos siempre actualizados, sacrificando velocidad y dependiendo de la red. Ideal para llamadas a APIs o datos que cambian con frecuencia.

**Stale-While-Revalidate** — Retorna inmediatamente lo que haya en caché (stale = "viejo") para que el usuario no espere, y simultáneamente lanza una petición a la red en segundo plano para actualizar el caché. El usuario ve contenido al instante; en la próxima visita ya tendrá la versión más reciente. Es el mejor balance entre velocidad y frescura, ideal para páginas HTML de la SPA.

| Estrategia | Velocidad | Frescura | Offline | Uso típico |
|---|---|---|---|---|
| Cache First | ⚡ Máxima | Baja | ✅ Sí | JS, CSS, imágenes |
| Network First | Depende de red | ✅ Alta | Solo si hay caché | APIs, datos dinámicos |
| Stale-While-Revalidate | ⚡ Máxima | Media (async) | ✅ Sí | Páginas HTML |

### Seguridad y TLS

Los Service Workers **solo funcionan bajo HTTPS**. No es una recomendación, es un requisito técnico impuesto por todos los navegadores modernos. La única excepción permitida es `localhost` para desarrollo local.

La razón es el riesgo que representaría un SW sobre HTTP: dado que el SW intercepta y puede modificar todas las peticiones de la app, si fuera posible instalarlo en una conexión no cifrada, un atacante posicionado entre el usuario y el servidor (ataque Man-in-the-Middle) podría inyectar un SW malicioso que espiara credenciales, modificara respuestas o redirigiera tráfico. Y lo más peligroso: el SW malicioso persistiría en el dispositivo del usuario incluso después de cerrar la pestaña.

HTTPS resuelve esto: el handshake TLS cifra la conexión de extremo a extremo y verifica mediante el certificado que el servidor es quien dice ser. Así, el SW que descarga el navegador es garantizadamente el del servidor legítimo, sin posibilidad de modificación en tránsito.

**Impacto en el Install Prompt** — El navegador evalúa varios criterios antes de mostrar el ícono de instalación de la PWA. El certificado SSL válido es la condición base e indispensable:

| Criterio | Requerimiento |
|---|---|
| HTTPS con certificado válido | Obligatorio |
| `manifest.json` con campos requeridos | Obligatorio |
| Íconos PNG 192×192 y 512×512 | Obligatorio |
| Service Worker registrado y activo | Obligatorio |

Un certificado autofirmado o expirado hace que el navegador muestre advertencia de seguridad y bloquea el install prompt por completo. Por eso se utiliza **Let's Encrypt** (via Certbot), una Autoridad Certificadora reconocida globalmente que emite certificados firmados y gratuitos, renovables cada 90 días.

---

## Parte 2: Implementación

### Estructura del proyecto

```
├── src/
│   ├── main.tsx        # Entrada: monta React y registra el SW
│   ├── App.tsx         # Task Manager con LocalStorage
│   └── App.css         # Estilos
├── public/
│   ├── manifest.json   # Configuración PWA
│   └── sw.js           # Service Worker (3 estrategias)
├── generate-icons.mjs  # Genera íconos PNG sin dependencias externas
├── Dockerfile          # Build multi-etapa: Node → Nginx
├── docker-compose.yml  # Levanta el contenedor con certs SSL montados
└── nginx.conf          # HTTPS, redirect 80→443, cabeceras de seguridad
```

### Desarrollo local

```bash
npm install
npm run dev       # genera íconos automáticamente y levanta Vite
```

### Despliegue

```bash
# En el servidor IONOS
certbot certonly --standalone -d 198.71.54.179.nip.io
git clone https://github.com/Aethertito/pwa-ionos-ernesto-garcia..git pwa-app
cd pwa-app
docker-compose up -d --build
```

El `Dockerfile` usa dos etapas: `node:20-alpine` para compilar el proyecto con Vite, y `nginx:stable-alpine` para servir los archivos del `/dist` en producción.
