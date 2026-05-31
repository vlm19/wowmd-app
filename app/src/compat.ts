// Cross-context compatibility shims.
//
// `crypto.subtle` and `crypto.randomUUID` are only exposed in *secure contexts*
// (HTTPS or localhost). When the app is opened over plain http (LAN IP) or
// file://, they are undefined and calling them throws — which previously broke
// opening documents and creating annotations outright. These shims keep the app
// working everywhere by falling back to deterministic, dependency-free code.

/**
 * SHA-256 of a string, hex-encoded. Uses Web Crypto when available, otherwise a
 * pure-JS implementation that produces the *identical* digest, so a document's
 * fingerprint (and therefore its annotation storage key) is the same regardless
 * of whether the page is served from a secure context.
 */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const buffer = await subtle.digest('SHA-256', new TextEncoder().encode(input))
    return bytesToHex(new Uint8Array(buffer))
  }
  return sha256HexSync(input)
}

/** UUID v4. Prefers crypto.randomUUID, then getRandomValues (works in insecure
 *  contexts), then Math.random as a last resort. Never throws. */
export function randomId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant

  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** Pure-JS SHA-256 (FIPS 180-4). Matches crypto.subtle.digest('SHA-256', utf8). */
export function sha256HexSync(input: string): string {
  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const bytes = new TextEncoder().encode(input)
  const bitLen = bytes.length * 8
  const withOne = bytes.length + 1
  const padZeros = (56 - (withOne % 64) + 64) % 64
  const total = withOne + padZeros + 8

  const buf = new Uint8Array(total)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false)
  view.setUint32(total - 4, bitLen >>> 0, false)

  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0
      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }

    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
    h5 = (h5 + f) | 0
    h6 = (h6 + g) | 0
    h7 = (h7 + h) | 0
  }

  const hex = (x: number) => (x >>> 0).toString(16).padStart(8, '0')
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7)
}
