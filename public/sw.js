/**
 * Service Worker — Task Manager PWA
 * Autor: Ernesto Garcia Valenzuela
 * Universidad Tecnológica de Tijuana
 *
 * Estrategias implementadas:
 *  - Cache First      → Recursos estáticos (JS, CSS, imágenes, fuentes)
 *  - Network First    → Peticiones dinámicas / API
 *  - Stale-While-Revalidate → Documentos HTML
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE  = `static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`

/** Recursos pre-cacheados durante la instalación */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// ─────────────────────────────────────────────
// INSTALL — Pre-cachear el shell de la aplicación
// ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...')
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log('[SW] Pre-cache completado')
        return self.skipWaiting() // Activa el SW inmediatamente
      })
  )
})

// ─────────────────────────────────────────────
// ACTIVATE — Limpiar caches de versiones anteriores
// ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...')
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => {
              console.log('[SW] Eliminando cache obsoleto:', key)
              return caches.delete(key)
            })
        )
      )
      .then(() => self.clients.claim()) // Tomar control de todas las pestañas
  )
})

// ─────────────────────────────────────────────
// FETCH — Interceptar peticiones (proxy de red)
// ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Solo interceptar peticiones GET del mismo origen
  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return

  const destination = request.destination

  // Cache First: recursos estáticos compilados por Vite
  if (
    destination === 'script' ||
    destination === 'style' ||
    destination === 'image' ||
    destination === 'font'
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Stale-While-Revalidate: documentos HTML (navegación)
  if (destination === 'document') {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Network First: cualquier otra petición
  event.respondWith(networkFirst(request))
})

// ─────────────────────────────────────────────
// ESTRATEGIA 1: Cache First
// Sirve desde caché; si no existe, descarga y cachea.
// Ideal para assets estáticos que cambian poco.
// ─────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Recurso no disponible offline', { status: 503 })
  }
}

// ─────────────────────────────────────────────
// ESTRATEGIA 2: Network First
// Intenta la red primero; si falla, usa caché.
// Ideal para datos dinámicos donde la frescura importa.
// ─────────────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return (
      cached ||
      new Response(JSON.stringify({ error: 'Sin conexión' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }
}

// ─────────────────────────────────────────────
// ESTRATEGIA 3: Stale-While-Revalidate
// Retorna caché inmediatamente Y actualiza en segundo plano.
// Balance entre velocidad y frescura de datos.
// ─────────────────────────────────────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cached = await cache.match(request)

  // Actualizar en background sin bloquear la respuesta
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  })

  // Si hay caché, retornarlo inmediatamente; si no, esperar la red
  return cached || networkPromise
}
