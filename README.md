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

El `manifest.json` le dice al navegador cómo comportarse cuando la app se instala en el dispositivo.

- **`theme_color`** — Color que el sistema operativo aplica a la barra de estado y la barra del navegador. Debe coincidir con `<meta name="theme-color">` en el HTML.
- **`background_color`** — Color de fondo de la splash screen que aparece mientras la app carga al abrirse como app instalada.
- **`display: standalone`** — La app se ejecuta sin la barra de dirección ni los controles del navegador, como una app nativa. Con `browser` se abre en una pestaña normal, perdiendo la experiencia de app.
- **Array de `icons`** — Chrome requiere al menos un ícono PNG de 192×192 y otro de 512×512 para habilitar el install prompt. El sistema los usa en el lanzador, la splash screen y el dock del dispositivo.

### Service Workers

Un Service Worker es un script que corre en un hilo separado al del navegador. Actúa como un **proxy de red del lado del cliente**: intercepta todas las peticiones que hace la aplicación y decide si responde desde el caché o las deja pasar a la red.

**Registro:**
```js
navigator.serviceWorker.register('/sw.js')
```

**Ciclo de vida:**

1. **Install** — Se descarga el `sw.js` y se pre-cachean los recursos estáticos del shell de la app (`caches.addAll`). Se llama `skipWaiting()` para que el SW se active de inmediato.
2. **Activate** — Se eliminan los caches de versiones anteriores. Se llama `clients.claim()` para tomar control de todas las pestañas abiertas sin necesidad de recargar.
3. **Fetch** — Por cada petición de la app se dispara el evento `fetch`. Aquí el SW aplica la estrategia de caché correspondiente y llama `event.respondWith()` con la respuesta.

### Estrategias de Caché

| Estrategia | Funcionamiento | Cuándo usarla |
|---|---|---|
| **Cache First** | Busca en caché primero; solo va a la red si no hay nada | Assets estáticos (JS, CSS, imágenes) que no cambian |
| **Network First** | Intenta la red primero; usa caché solo si la red falla | Datos dinámicos o APIs donde la frescura importa |
| **Stale-While-Revalidate** | Retorna el caché inmediatamente y actualiza en segundo plano | Páginas HTML: respuesta rápida + contenido siempre actualizado en la próxima visita |

### Seguridad y TLS

Los Service Workers solo funcionan bajo **HTTPS**. La razón es que el SW intercepta todas las peticiones de la app — si se pudiera instalar sobre HTTP, un atacante podría inyectar un SW malicioso a través de una conexión no segura y quedarse espiando o modificando el tráfico indefinidamente, incluso después de que el usuario cierre la página.

HTTPS garantiza mediante TLS que el SW descargado es exactamente el del servidor legítimo, sin posibilidad de modificación en tránsito. La única excepción permitida es `localhost` para desarrollo local.

Respecto al **Install Prompt**: el navegador solo muestra el ícono de instalar la app si el sitio cumple todos los criterios de PWA, siendo HTTPS el primero y más importante. Un certificado autofirmado o expirado bloquea el install prompt completamente. Por eso se usa **Let's Encrypt**, una CA reconocida globalmente que emite certificados válidos y gratuitos.

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
