# Task Manager PWA

**Autor:** Ernesto Garcia Valenzuela
**Materia:** Desarrollo Web Profesional
**Institución:** Universidad Tecnológica de Tijuana
**Docente:** Mike Cardona (@mikecardona076)

**🔗 Demo en vivo:** https://198.71.54.179.nip.io
**📦 Repositorio:** https://github.com/Aethertito/pwa-ionos-ernesto-garcia

---

## Stack Tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| React | 18 | UI Library |
| TypeScript | 5 | Tipado estático |
| Vite | 5 | Build tool / Dev server |
| Nginx | stable-alpine | Servidor web |
| Docker | multi-stage | Contenedorización |
| Let's Encrypt | — | Certificados SSL/TLS |

---

## Parte 1: Investigación Teórica sobre PWA

### 1. Web App Manifest (`manifest.json`)

El `manifest.json` es un archivo de configuración en formato JSON que le proporciona al navegador los metadatos necesarios para tratar la aplicación web como una app instalable. Es el contrato entre la PWA y el sistema operativo del dispositivo.

#### Propiedad `theme_color`

Define el color que el sistema operativo utiliza para personalizar la interfaz alrededor de la aplicación. En Android y Chrome, colorea la barra de estado del sistema y la barra de la ventana del navegador cuando se accede en modo navegador. Es la primera impresión visual de la marca de la app.

```json
"theme_color": "#6366f1"
```

> **Importante:** Este valor debe coincidir con la meta etiqueta `<meta name="theme-color">` en el HTML para una experiencia consistente antes y después de la instalación.

#### Propiedad `background_color`

Establece el color de fondo de la **splash screen** (pantalla de bienvenida) que aparece mientras la aplicación carga después de ser lanzada como app instalada. Esta pantalla se genera automáticamente por el sistema combinando el icono de la app con este color de fondo, brindando una transición visual fluida.

```json
"background_color": "#0f0f23"
```

#### Propiedad `display` — `standalone` vs `browser`

La propiedad `display` es crítica porque define **el grado de integración nativa** de la PWA:

| Valor | Comportamiento | Caso de uso |
|---|---|---|
| `standalone` | Sin barra de dirección ni controles del navegador. La app ocupa toda la ventana como una app nativa | PWAs que buscan experiencia nativa (recomendado) |
| `browser` | Se abre en una pestaña normal del navegador con toda la UI del mismo | Apps que dependen de la navegación del browser |
| `minimal-ui` | Igual a standalone pero conserva botones de navegación mínimos (atrás, recargar) | Apps con flujos de navegación complejos |
| `fullscreen` | Ocupa la pantalla completa del dispositivo, sin ningún elemento del SO | Juegos, apps de video/cámara |

Con `"display": "standalone"`, el navegador elimina su propia interfaz y la app se integra como una aplicación nativa en el escritorio/dock del dispositivo.

#### Array de `icons`

El array de íconos es el **requisito más crítico para la instalabilidad** de la PWA. El navegador utiliza este array para:

1. **Mostrar el icono de instalación** en la barra de dirección o el prompt nativo
2. **Generar la splash screen** combinando el icono con `background_color`
3. **Representar la app** en el lanzador de aplicaciones, dock, y pantalla de inicio del SO

Chrome Desktop requiere al menos un ícono de **192×192px** y otro de **512×512px** en formato PNG para habilitar el install prompt. La propiedad `purpose: "maskable"` permite que el SO aplique la forma de su máscara (círculo, squircle, etc.) al ícono sin recortar el contenido importante.

```json
"icons": [
  { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
]
```

---

### 2. Service Workers

#### Definición y rol como proxy de red

Un Service Worker es un **script JavaScript que corre en un hilo separado** (worker thread) al margen del hilo principal del navegador. A diferencia del JavaScript convencional, no tiene acceso al DOM, pero tiene la capacidad de **interceptar todas las peticiones de red** que hace la aplicación.

Funciona exactamente como un **proxy inverso del lado del cliente**: se posiciona entre la aplicación y la red, pudiendo:
- Servir respuestas desde el caché sin tocar la red
- Modificar peticiones y respuestas
- Encolar peticiones cuando no hay red y ejecutarlas después (Background Sync)
- Recibir y mostrar notificaciones push incluso con la app cerrada

```
┌─────────────┐    fetch()    ┌──────────────────┐    fetch()    ┌─────────┐
│  React App  │ ──────────►  │  Service Worker  │ ──────────►  │   Red   │
│             │ ◄──────────  │  (Proxy cliente) │ ◄──────────  │         │
└─────────────┘   respuesta  └──────────────────┘   respuesta  └─────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │  Cache API   │
                              └──────────────┘
```

#### Proceso de registro

El registro del Service Worker se realiza desde el hilo principal de la aplicación, generalmente en el punto de entrada (`main.tsx`):

```typescript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('SW registrado. Scope:', registration.scope)
      })
      .catch(error => {
        console.error('Error al registrar SW:', error)
      })
  })
}
```

> **Consideraciones clave del registro:**
> - Se verifica primero que el navegador soporte Service Workers (`'serviceWorker' in navigator`)
> - El registro ocurre en el evento `load` para no bloquear la carga inicial de la página
> - El `scope` determina qué URLs controla el SW (por defecto, el directorio donde está `sw.js`)
> - HTTPS es **obligatorio** (ver sección de Seguridad)

#### Ciclo de vida del Service Worker

El ciclo de vida tiene tres fases principales con eventos bien definidos:

```
Registro
   │
   ▼
┌─────────────────────────────────────┐
│  FASE 1: INSTALLATION               │
│  Evento: 'install'                  │
│  • Se descarga el sw.js             │
│  • Se pre-cachean recursos estáticos│
│  • skipWaiting() para activar ya    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  FASE 2: ACTIVATION                 │
│  Evento: 'activate'                 │
│  • Limpiar caches de versiones viejas│
│  • clients.claim() toma control     │
│  • El SW es ahora el activo         │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  FASE 3: FETCHING (Idle/Running)    │
│  Evento: 'fetch'                    │
│  • Intercepta TODAS las peticiones  │
│  • Aplica estrategia de caché       │
│  • Sirve respuesta al cliente       │
└─────────────────────────────────────┘
```

**Evento `install`:**
```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('static-v1').then(cache => cache.addAll(['/','index.html','/manifest.json']))
  )
  self.skipWaiting() // No esperar, activar inmediatamente
})
```

**Evento `activate`:**
```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== 'static-v1').map(k => caches.delete(k)))
    )
  )
  self.clients.claim() // Controlar pestañas existentes sin recargar
})
```

**Evento `fetch`:**
```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(/* estrategia de caché */)
})
```

---

### 3. Estrategias de Almacenamiento (Caching)

La elección de estrategia de caché determina el balance entre **velocidad**, **frescura de datos** y **disponibilidad offline**.

#### Comparativa técnica

| Criterio | Cache First | Network First | Stale-While-Revalidate |
|---|---|---|---|
| **Velocidad de respuesta** | ⚡ Máxima (caché) | 🐢 Depende de la red | ⚡ Máxima (caché) |
| **Frescura de datos** | ❌ Baja | ✅ Alta | ⚠️ Media (async) |
| **Offline** | ✅ Completo | ⚠️ Solo si hay caché | ✅ Si hay caché |
| **Uso de red** | Mínimo | Siempre | Eventual |
| **Caso de uso ideal** | Assets estáticos JS/CSS/imágenes | APIs, datos dinámicos | Páginas HTML, contenido semidestacado |

#### Cache First

**Flujo:** Caché → (si no existe) → Red → guardar en caché

```javascript
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached                    // Retorna caché instantáneamente

  const response = await fetch(request)        // Solo va a red si no hay caché
  if (response.ok) {
    const cache = await caches.open('static-v1')
    cache.put(request, response.clone())
  }
  return response
}
```

**Ideal para:** Archivos JS, CSS, fuentes, imágenes. Vite les añade un hash al nombre de archivo (ej. `main.a3f2c1.js`), garantizando que los archivos nuevos nunca coincidan con el caché antiguo.

#### Network First

**Flujo:** Red → (si falla) → Caché

```javascript
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open('dynamic-v1')
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return caches.match(request) || new Response('Sin conexión', { status: 503 })
  }
}
```

**Ideal para:** Peticiones a APIs REST, datos que cambian frecuentemente. Prioriza siempre tener datos actuales, recurriendo al caché solo como fallback offline.

#### Stale-While-Revalidate

**Flujo:** Retorna caché inmediatamente + actualiza caché en background de forma asíncrona

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open('dynamic-v1')
  const cached = await cache.match(request)

  // Actualización en background — no bloquea la respuesta
  const networkPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone())
    return response
  })

  return cached || networkPromise  // Responde rápido si hay caché
}
```

**Ideal para:** Páginas HTML de la SPA. Combina la velocidad del caché con la actualización progresiva: el usuario ve contenido inmediatamente y la próxima visita tendrá la versión actualizada.

---

### 4. Seguridad y TLS

#### ¿Por qué HTTPS es un requisito habilitador para los Service Workers?

HTTPS no es una recomendación para los Service Workers: es un **requisito técnico y de seguridad** impuesto por todos los navegadores modernos. La única excepción permitida es `localhost` para desarrollo.

**Razón principal — Riesgo de ataque Man-in-the-Middle:**

Sin HTTPS, un Service Worker sería un vector de ataque extremadamente peligroso. Dado que el SW actúa como proxy de red y puede interceptar y modificar **todas** las peticiones, si fuera inyectado por un atacante en una conexión HTTP no segura, podría:

1. **Interceptar credenciales** (contraseñas, tokens, cookies)
2. **Modificar respuestas** del servidor para servir contenido malicioso
3. **Persistir indefinidamente** en el dispositivo del usuario, siguiendo activo incluso después de cerrar la pestaña
4. **Redirigir peticiones** a servidores controlados por el atacante

HTTPS garantiza mediante el handshake TLS que el SW descargado es exactamente el que está en el servidor legítimo, sin posibilidad de modificación en tránsito.

```
HTTP (vulnerable):
  Cliente ──────── SW inyectado ──────── Servidor
            ↑ Atacante puede modificar

HTTPS (seguro):
  Cliente ══════════════════════════════ Servidor
            Cifrado TLS extremo a extremo
```

#### Proceso de handshake TLS

Cuando el navegador se conecta al servidor por HTTPS:

1. **ClientHello** — El browser anuncia versiones TLS y cifrados soportados
2. **ServerHello** — El servidor elige el mejor cifrado compatible
3. **Certificate** — El servidor envía su certificado SSL (firmado por Let's Encrypt)
4. **Key Exchange** — Intercambio de claves asimétricas (ECDHE)
5. **Finished** — Canal cifrado simétrico establecido

Solo después de completar este handshake el navegador permite el registro de Service Workers.

#### Impacto de los certificados en el "Install Prompt"

El navegador evalúa múltiples criterios para mostrar el **Install Prompt** (botón de instalar app). El certificado SSL válido es la condición base:

| Criterio | Requerimiento |
|---|---|
| HTTPS con certificado válido | ✅ Obligatorio |
| `manifest.json` con campos requeridos | ✅ Obligatorio |
| Íconos PNG 192×192 y 512×512 | ✅ Obligatorio |
| Service Worker registrado y activo | ✅ Obligatorio |
| Certificado no expirado / no autofirmado | ✅ Obligatorio para candado verde |

Un certificado **autofirmado** o **expirado** hace que el navegador muestre una advertencia de seguridad y **bloquea el Install Prompt** completamente. Por esta razón se utiliza **Let's Encrypt** (Certbot), una autoridad certificadora (CA) reconocida globalmente que emite certificados válidos y gratuitos.

---

## Parte 2: Implementación Técnica

### Arquitectura

```
mike-pwa/
├── src/
│   ├── main.tsx          # Entrada: monta React + registra SW
│   ├── App.tsx           # Task Manager con estado y LocalStorage
│   ├── App.css           # Estilos del componente principal
│   └── index.css         # Reset global y estilos base
├── public/
│   ├── manifest.json     # Configuración PWA
│   ├── sw.js             # Service Worker (3 estrategias de caché)
│   └── icons/            # Íconos generados (no en git)
├── generate-icons.mjs    # Generador PNG sin dependencias externas
├── Dockerfile            # Build multi-etapa Node → Nginx
├── docker-compose.yml    # Orquestación con volumen de certs SSL
└── nginx.conf            # Servidor con HTTPS, redirect 80→443
```

### Persistencia de datos

La aplicación utiliza **LocalStorage** como mecanismo de persistencia:

```typescript
// Carga inicial desde LocalStorage
const [tasks, setTasks] = useState<Task[]>(() => {
  const stored = localStorage.getItem('pwa-tasks-ernesto')
  return stored ? JSON.parse(stored) : []
})

// Sincronización automática con cada cambio de estado
useEffect(() => {
  localStorage.setItem('pwa-tasks-ernesto', JSON.stringify(tasks))
}, [tasks])
```

Los datos persisten entre sesiones de navegador y están disponibles completamente **offline** gracias a la combinación de LocalStorage + Service Worker.

### Instrucciones de desarrollo local

```bash
# 1. Clonar el repositorio
git clone https://github.com/Aethertito/pwa-ionos-ernesto-garcia.git
cd pwa-ionos-ernesto-garcia

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo (genera íconos automáticamente via predev)
npm run dev

# 4. Abrir http://localhost:5173
```

### Construcción para producción

```bash
# Genera íconos + compila TypeScript + build Vite
npm run build

# Previsualizar el build de producción localmente
npm run preview
```

---

## Despliegue en IONOS con Docker + SSL

### Prerrequisitos en el servidor

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Instalar Certbot
apt install certbot -y
```

### Obtener certificado SSL con Let's Encrypt

Se utiliza el dominio gratuito `198.71.54.179.nip.io` que resuelve automáticamente a la IP del servidor, permitiendo usar Let's Encrypt con el challenge HTTP-01.

```bash
# Obtener certificado (Certbot levanta su propio servidor en puerto 80)
certbot certonly --standalone -d 198.71.54.179.nip.io

# El certificado queda en:
# /etc/letsencrypt/live/198.71.54.179.nip.io/fullchain.pem
# /etc/letsencrypt/live/198.71.54.179.nip.io/privkey.pem
```

### Clonar y desplegar

```bash
# Clonar el repositorio
git clone https://github.com/Aethertito/pwa-ionos-ernesto-garcia.git
cd pwa-ionos-ernesto-garcia

# Construir imagen y levantar contenedor
docker compose up -d --build

# Verificar que está corriendo
docker ps
docker logs pwa-task-manager
```

### Renovación automática del certificado

```bash
# Añadir cron para renovar el certificado cada 60 días
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker restart pwa-task-manager") | crontab -
```

---

## Verificación con Lighthouse

Para verificar que la PWA cumple todos los criterios:

1. Abrir la app en Chrome: `https://198.71.54.179.nip.io`
2. Abrir DevTools → pestaña **Lighthouse**
3. Seleccionar categoría **Progressive Web App**
4. Ejecutar análisis
5. Verificar:
   - ✅ Instalable (manifest + SW + HTTPS + íconos)
   - ✅ PWA optimizada (offline, splash screen, etc.)

---

## Criterios de evaluación cumplidos

| Criterio | Implementación |
|---|---|
| TypeScript correcto | `strict: true` en tsconfig, tipado explícito en todas las interfaces |
| Docker multi-etapa | `node:20-alpine` → `nginx:stable-alpine` |
| Ícono de instalación | manifest.json + SW + HTTPS + íconos 192/512px |
| Candado verde SSL | Let's Encrypt vía Certbot + redirect 80→443 |
| README técnico | Investigación de los 4 pilares de PWA documentada |
