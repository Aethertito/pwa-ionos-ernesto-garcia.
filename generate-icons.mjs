/**
 * Generador de íconos PNG para la PWA.
 * Usa módulos nativos de Node.js (zlib, fs) — sin dependencias externas.
 * Genera íconos de color sólido índigo (#6366f1) en todos los tamaños requeridos.
 */

import zlib from 'zlib'
import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = './public/icons'

// Color: indigo #6366f1 -> R=99, G=102, B=241
const R = 99, G = 102, B = 241

function makeCRCTable() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
}

const CRC_TABLE = makeCRCTable()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0)
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

function createPNG(size) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB color type
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Raw image data: filter byte (0) + RGB per row
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1)
    raw[rowStart] = 0 // None filter
    for (let x = 0; x < size; x++) {
      const off = rowStart + 1 + x * 3
      raw[off] = R
      raw[off + 1] = G
      raw[off + 2] = B
    }
  }

  const compressed = zlib.deflateSync(raw)

  return Buffer.concat([
    sig,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ])
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  const filename = `icon-${size}x${size}.png`
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), createPNG(size))
  console.log(`[icons] Generado: ${filename}`)
}

console.log('[icons] ¡Todos los íconos generados correctamente!')
