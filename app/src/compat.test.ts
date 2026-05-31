import { describe, expect, test } from 'vitest'
import { sha256Hex, sha256HexSync, randomId } from './compat'

describe('sha256HexSync — pure-JS fallback', () => {
  test('已知向量：空串', () => {
    expect(sha256HexSync('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  test('已知向量：abc', () => {
    expect(sha256HexSync('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  test('已知向量：fox', () => {
    expect(sha256HexSync('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    )
  })

  test('与 Web Crypto 一致（含 UTF-8、多分组、跨块边界）', async () => {
    const samples = [
      '',
      'a',
      '中文标注 with mixed 内容 🚀',
      'x'.repeat(55), // padding edge: 55 bytes
      'y'.repeat(56), // forces an extra 64-byte block
      'z'.repeat(1000),
      '# Heading\n\nA paragraph with **bold** and `code`.\n',
    ]
    for (const s of samples) {
      expect(sha256HexSync(s)).toBe(await sha256Hex(s))
    }
  })
})

describe('randomId — UUID v4', () => {
  test('格式：v4 + variant', () => {
    const id = randomId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test('唯一性（1000 次无碰撞）', () => {
    const set = new Set<string>()
    for (let i = 0; i < 1000; i += 1) set.add(randomId())
    expect(set.size).toBe(1000)
  })
})
