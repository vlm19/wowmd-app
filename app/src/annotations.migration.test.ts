/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, test } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import {
  migrateAnnotation,
  migrateAnnotationArray,
  isValidAnnotation,
  extractSectionBody,
  createTicketExport,
  reanchorAnnotationOffset,
  loadAnnotations,
  saveAnnotations,
  loadAnnotationsFromDb,
} from './annotations'
import type { Annotation } from './annotations'
import {
  normalizeUrl,
  saveLocalDocument,
  findLocalDocumentByUrl,
  createDocumentVersion,
  getDocumentLineage,
  createDocId,
} from './localDocuments'

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  localStorage.clear()
})

function makeOld(color: string, note = '', overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    documentFingerprint: 'abc123',
    quote: 'some text',
    prefix: 'pre',
    suffix: 'suf',
    headingPath: ['H1', 'H2'],
    offset: 42,
    color,
    note,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('migrateAnnotation — 6色 → 4类型', () => {
  test('所有 6 色 → type=null, legacyColor=原色', () => {
    const colors = ['yellow', 'blue', 'green', 'rose', 'violet', 'amber'] as const
    for (const color of colors) {
      const result = migrateAnnotation(makeOld(color))
      expect(result.type).toBeNull()
      expect(result.legacyColor).toBe(color)
      expect(result.color).toBe(color)
    }
  })

  test('有 color 无 note → type=null, note=""', () => {
    const result = migrateAnnotation(makeOld('blue'))
    expect(result.type).toBeNull()
    expect(result.note).toBe('')
    expect(result.legacyColor).toBe('blue')
  })

  test('有 color 有 note → note 原样保留，legacyColor=原色', () => {
    const result = migrateAnnotation(makeOld('green', '这里很重要'))
    expect(result.note).toBe('这里很重要')
    expect(result.legacyColor).toBe('green')
    expect(result.type).toBeNull()
  })

  test('suggestedReplacement 始终为 ""', () => {
    const result = migrateAnnotation(makeOld('amber', '测试'))
    expect(result.suggestedReplacement).toBe('')
  })

  test('orphaned 始终为 false', () => {
    const result = migrateAnnotation(makeOld('rose'))
    expect(result.orphaned).toBe(false)
  })

  test('quote/prefix/suffix/headingPath/offset/id 原样直通', () => {
    const result = migrateAnnotation(makeOld('violet', '备注', {
      quote: 'custom quote',
      prefix: 'custom pre',
      suffix: 'custom suf',
      headingPath: ['H1'],
      offset: 99,
    }))
    expect(result.quote).toBe('custom quote')
    expect(result.prefix).toBe('custom pre')
    expect(result.suffix).toBe('custom suf')
    expect(result.headingPath).toEqual(['H1'])
    expect(result.offset).toBe(99)
  })

  test('createdAt/updatedAt 原样保留', () => {
    const result = migrateAnnotation(makeOld('yellow'))
    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(result.updatedAt).toBe('2025-01-02T00:00:00.000Z')
  })

  test('note 正文不追加 [migrated from ...] 标记', () => {
    const result = migrateAnnotation(makeOld('yellow', '用户笔记'))
    expect(result.note).toBe('用户笔记')
    expect(result.note).not.toContain('migrated')
  })

  test('无效 color 回退到 yellow', () => {
    const result = migrateAnnotation({ ...makeOld('yellow'), color: 'invalid' })
    expect(result.color).toBe('yellow')
    expect(result.legacyColor).toBe('yellow')
  })

  test('缺字段时使用默认值', () => {
    const result = migrateAnnotation({ color: 'green' })
    expect(result.id).toBeTypeOf('string')
    expect(result.documentFingerprint).toBe('')
    expect(result.quote).toBe('')
    expect(result.offset).toBe(-1)
    expect(result.headingPath).toEqual([])
    expect(result.note).toBe('')
    expect(result.suggestedReplacement).toBe('')
    expect(result.type).toBeNull()
    expect(result.orphaned).toBe(false)
  })
})

describe('isValidAnnotation — 验证规则', () => {
  function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
    return {
      id: 'a1',
      documentId: '',
      documentFingerprint: 'abc',
      quote: 'text',
      prefix: '',
      suffix: '',
      headingPath: [],
      offset: 0,
      type: null,
      note: '',
      suggestedReplacement: '',
      color: 'yellow',
      legacyColor: null,
      orphaned: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  test('type=null, note="", legacyColor=null → 非法', () => {
    expect(isValidAnnotation(makeAnnotation({ legacyColor: null }))).toBe(false)
  })

  test('type="clarify", note="" → 合法', () => {
    expect(isValidAnnotation(makeAnnotation({ type: 'clarify', note: '', legacyColor: null }))).toBe(true)
  })

  test('type=null, note="内容" → 合法', () => {
    expect(isValidAnnotation(makeAnnotation({ type: null, note: '内容', legacyColor: null }))).toBe(true)
  })

  test('type="dispute", note="内容" → 合法', () => {
    expect(isValidAnnotation(makeAnnotation({ type: 'dispute', note: '内容' }))).toBe(true)
  })

  test('type=null, note="", legacyColor="yellow" → 合法（迁移标注）', () => {
    expect(isValidAnnotation(makeAnnotation({ type: null, note: '', legacyColor: 'yellow' }))).toBe(true)
  })

  test('所有 4 种类型各自合法', () => {
    for (const t of ['clarify', 'dispute', 'important', 'confirmed'] as const) {
      expect(isValidAnnotation(makeAnnotation({ type: t, note: '', legacyColor: null }))).toBe(true)
    }
  })
})

describe('migrateAnnotationArray — 批量迁移', () => {
  test('三条旧标注 → 三条迁移后标注', () => {
    const old = [
      { color: 'yellow', note: '?' },
      { color: 'blue', note: '重要' },
      { color: 'green', note: '' },
    ]
    const result = migrateAnnotationArray(old)
    expect(result).toHaveLength(3)
    expect(result[0].legacyColor).toBe('yellow')
    expect(result[0].note).toBe('?')
    expect(result[2].legacyColor).toBe('green')
  })

  test('过滤无效标注', () => {
    const old = [
      { color: 'yellow', note: '' },          // legacyColor set → valid
      { color: 'yellow', note: 'has note' },  // valid
    ]
    const result = migrateAnnotationArray(old)
    expect(result).toHaveLength(2)
  })

  test('空数组返回空', () => {
    expect(migrateAnnotationArray([])).toEqual([])
  })
})

describe('extractSectionBody', () => {
  const doc = [
    '# Title',
    '',
    'intro text here.',
    '',
    '## Section A',
    '',
    'content of section A.',
    '',
    '### Sub A1',
    '',
    'deeper content.',
    '',
    '## Section B',
    '',
    'content of section B.',
    '',
    'more B content.',
  ].join('\n')

  test('按 headingPath 找到目标节', () => {
    const body = extractSectionBody(doc, ['Section A'])
    expect(body).toContain('content of section A.')
    expect(body).not.toContain('Section B')
  })

  test('空 headingPath 返回空', () => {
    expect(extractSectionBody(doc, [])).toBe('')
  })

  test('找不到标题返回空', () => {
    expect(extractSectionBody(doc, ['Not Found'])).toBe('')
  })

  test('最深标题的子节内容', () => {
    const body = extractSectionBody(doc, ['Section A', 'Sub A1'])
    expect(body).toContain('deeper content.')
    expect(body).not.toContain('content of section A.')
  })
})

describe('createTicketExport', () => {
  const annotations: Annotation[] = [
    {
      id: 'a1',
      documentId: '',
      documentFingerprint: 'abc',
      quote: 'hello',
      prefix: 'pre',
      suffix: 'suf',
      headingPath: ['Section A'],
      offset: 5,
      type: 'clarify',
      note: 'needs explanation',
      suggestedReplacement: 'hello world',
      color: 'blue',
      legacyColor: null,
      orphaned: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ]
  const markdown = '# Title\n\nintro.\n\n## Section A\n\ncontent here.\n'

  test('generates the ticket envelope', () => {
    const ticket = createTicketExport('My Doc', 'local', 'fp123', markdown, annotations)
    expect(ticket.schemaVersion).toBe(3)
    expect(ticket).toHaveProperty('document')
    expect(ticket).toHaveProperty('typeLegend')
    expect(ticket).toHaveProperty('tickets')
    expect(ticket).toHaveProperty('executionContract')
    expect(ticket).toHaveProperty('sections')
    expect(ticket).toHaveProperty('confirmedZones')
    expect(ticket.document.title).toBe('My Doc')
    expect(ticket.document.source).toBe('local')
    expect(ticket.document.fingerprint).toBe('fp123')
    expect(ticket.document.markdownSnapshot).toBe(markdown)
  })

  test('typeLegend contains the four review types', () => {
    const ticket = createTicketExport('x', 'x', 'x', markdown, annotations)
    expect(Object.keys(ticket.typeLegend)).toEqual(['clarify', 'dispute', 'important', 'confirmed'])
  })

  test('converts each annotation to an addressable ticket item', () => {
    const ticket = createTicketExport('x', 'x', 'x', markdown, annotations)
    expect(ticket.tickets).toHaveLength(1)
    expect(ticket.tickets[0].id).toBe('a1')
    expect(ticket.tickets[0].sequence).toBe(1)
    expect(ticket.tickets[0].type).toBe('clarify')
    expect(ticket.tickets[0].quote).toBe('hello')
    expect(ticket.tickets[0].note).toBe('needs explanation')
    expect(ticket.tickets[0].suggestedReplacement).toBe('hello world')
  })

  test('omits empty note fields', () => {
    const a = [{ ...annotations[0], note: '' }]
    const ticket = createTicketExport('x', 'x', 'x', markdown, a)
    expect(ticket.tickets[0].note).toBeUndefined()
  })

  test('omits empty suggestedReplacement fields', () => {
    const a = [{ ...annotations[0], suggestedReplacement: '' }]
    const ticket = createTicketExport('x', 'x', 'x', markdown, a)
    expect(ticket.tickets[0].suggestedReplacement).toBeUndefined()
  })

  test('includes external-AI lineage output instructions when provenance is provided', () => {
    const ticket = createTicketExport('My Doc', 'local', 'fp123', markdown, annotations, {
      lineageId: 'lineage-real',
      documentId: 'doc-real',
      bodyHash: 'sha256:real',
      filename: 'my-doc.md',
    })
    expect(ticket.schemaVersion).toBe(3)
    expect(ticket.ticketId).toMatch(/^ticket_/)
    expect(ticket.sourceDocument).toMatchObject({
      lineageId: 'lineage-real',
      documentId: 'doc-real',
      bodyHash: 'sha256:real',
      filename: 'my-doc.md',
    })
    expect(ticket.lineageOutput).toMatchObject({
      mode: 'external-ai-candidate',
      bodyHashPolicy: 'omit-if-not-computable',
      lineageId: 'lineage-real',
      parentDocumentId: 'doc-real',
      sourceTicketId: ticket.ticketId,
    })
    expect(ticket.lineageOutput?.template).toContain('wowmd:document-meta:v1')
  })

  test('groups executable tickets by section and keeps confirmed zones separate', () => {
    const more = [
      annotations[0],
      {
        ...annotations[0],
        id: 'a2',
        type: 'confirmed' as const,
        quote: 'content',
        suggestedReplacement: '',
      },
      {
        ...annotations[0],
        id: 'a3',
        type: 'dispute' as const,
        quote: 'intro',
        headingPath: [],
      },
    ]
    const ticket = createTicketExport('x', 'x', 'x', markdown, more)
    expect(ticket.sections).toEqual([
      {
        headingPath: ['Section A'],
        sectionBody: 'content here.',
        ticketIds: ['a1'],
      },
      {
        headingPath: [],
        sectionBody: '',
        ticketIds: ['a3'],
      },
    ])
    expect(ticket.confirmedZones).toEqual([
      {
        ticketId: 'a2',
        headingPath: ['Section A'],
        quote: 'content',
        prefix: 'pre',
        suffix: 'suf',
      },
    ])
  })
})

describe('IndexedDB 迁移', () => {
  async function seedV1Store(items: Array<Record<string, unknown>>) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('wowmd-pro', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('annotations', { keyPath: 'documentFingerprint' })
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('annotations', 'readwrite')
        tx.objectStore('annotations').put({
          documentFingerprint: 'fp1',
          items,
          updatedAt: new Date().toISOString(),
        })
        tx.oncomplete = () => { db.close(); resolve() }
      }
    })
  }

  test('v1 DB 播种 3 条旧标注 → v2 升级 → annotations_v2 有 3 条迁移后标注', async () => {
    await seedV1Store([makeOld('yellow'), makeOld('blue', 'note'), makeOld('rose')])

    const migrated = await loadAnnotationsFromDb('doc1', 'fp1')

    expect(migrated).toHaveLength(3)
    expect(migrated.every((a) => a.type === null)).toBe(true)
    expect(migrated.map((a) => a.legacyColor)).toEqual(['yellow', 'blue', 'rose'])
  })

  test('空 v1 DB → v2 升级 → annotations_v2 空，不报错', async () => {
    await seedV1Store([])

    const migrated = await loadAnnotationsFromDb('docEmpty', 'fp1')
    expect(migrated).toEqual([])
  })

  test('迁移后旧 annotations store 仍在、数据不变', async () => {
    const oldItems = [makeOld('green', 'n1'), makeOld('amber', 'n2')]
    await seedV1Store(oldItems)

    await loadAnnotationsFromDb('doc2', 'fp1')

    // v1 store 仍在且数据不变
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('wowmd-pro', 2)
      req.onsuccess = () => resolve(req.result)
    })
    const v1Data = await new Promise<{ items: unknown[] }>((resolve) => {
      const tx = db.transaction('annotations', 'readonly')
      const getReq = tx.objectStore('annotations').get('fp1')
      getReq.onsuccess = () => resolve(getReq.result)
    })
    db.close()

    expect(v1Data).toBeDefined()
    expect(Array.isArray(v1Data.items)).toBe(true)
    expect(v1Data.items).toHaveLength(2)
  })

  test('多个 documentFingerprint → 按 documentId 正确分组写入', async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('wowmd-pro', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('annotations', { keyPath: 'documentFingerprint' })
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('annotations', 'readwrite')
        tx.objectStore('annotations').put({
          documentFingerprint: 'fp1',
          items: [makeOld('yellow')],
          updatedAt: new Date().toISOString(),
        })
        tx.objectStore('annotations').put({
          documentFingerprint: 'fp2',
          items: [makeOld('blue')],
          updatedAt: new Date().toISOString(),
        })
        tx.oncomplete = () => { db.close(); resolve() }
      }
    })

    const r1 = await loadAnnotationsFromDb('docA', 'fp1')
    const r2 = await loadAnnotationsFromDb('docB', 'fp2')

    expect(r1).toHaveLength(1)
    expect(r1[0].legacyColor).toBe('yellow')
    expect(r2).toHaveLength(1)
    expect(r2[0].legacyColor).toBe('blue')
  })

  test('onupgradeneeded 只建 annotations_v2 store，不做数据迁移', async () => {
    await seedV1Store([makeOld('violet')])

    // 模拟打开：新版 schema 升级建 v2 store，但不主动迁数据
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('wowmd-pro', 2)
      req.onupgradeneeded = () => {
        const database = req.result
        if (!database.objectStoreNames.contains('annotations_v2')) {
          database.createObjectStore('annotations_v2', { keyPath: 'documentId' })
        }
      }
      req.onsuccess = () => resolve(req.result)
    })

    const v2Empty = await new Promise<unknown>((resolve) => {
      const tx = db.transaction('annotations_v2', 'readonly')
      const getReq = tx.objectStore('annotations_v2').get('fp1')
      getReq.onsuccess = () => resolve(getReq.result)
    })

    expect(v2Empty).toBeUndefined()
    db.close()
  })
})

describe('localStorage 迁移', () => {
  test('v1 键读取 → 迁移 → v2 键写入，v1 键保留', () => {
    localStorage.setItem('wowmd.annotations.v1.fp1', JSON.stringify([makeOld('green', 'n')]))
    const out = loadAnnotations('doc1', 'fp1')
    expect(out).toHaveLength(1)
    expect(out[0].legacyColor).toBe('green')
    expect(localStorage.getItem('wowmd.annotations.v2.doc1')).not.toBeNull()
    expect(localStorage.getItem('wowmd.annotations.v1.fp1')).not.toBeNull()
  })

  test('v2 键有数据时直接返回，不读 v1', () => {
    const v2Data = [{ ...migrateAnnotation(makeOld('blue')), id: 'v2-id', documentId: 'doc2' }]
    localStorage.setItem('wowmd.annotations.v2.doc2', JSON.stringify(v2Data))
    localStorage.setItem('wowmd.annotations.v1.fp2', JSON.stringify([makeOld('yellow')]))

    const out = loadAnnotations('doc2', 'fp2')
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('v2-id')
  })

  test('v2 键不存在 → 回退 v1 → 触发迁移写入 v2 → 返回迁移后数据', () => {
    localStorage.setItem('wowmd.annotations.v1.fp3', JSON.stringify([makeOld('amber', 'keep')]))
    const out = loadAnnotations('doc3', 'fp3')
    expect(out).toHaveLength(1)
    expect(out[0].legacyColor).toBe('amber')
    expect(out[0].note).toBe('keep')
    expect(localStorage.getItem('wowmd.annotations.v2.doc3')).not.toBeNull()
  })

  test('迁移后新写入仅写 v2 键', () => {
    const ann = migrateAnnotation(makeOld('rose', 'x'))
    ann.documentId = 'doc4'
    saveAnnotations('doc4', [ann])

    expect(localStorage.getItem('wowmd.annotations.v2.doc4')).not.toBeNull()
    // v1 key for same doc should not have been written by saveAnnotations
    const v1Keys = Object.keys(localStorage).filter((k) => k.startsWith('wowmd.annotations.v1.'))
    expect(v1Keys.every((k) => !k.includes('doc4'))).toBe(true)
  })
})

describe('reanchorAnnotationOffset — 自动重锚', () => {
  const anno = (over: Partial<{ quote: string; prefix: string; suffix: string; offset: number }>) => ({
    quote: 'the quick brown fox',
    prefix: '',
    suffix: '',
    offset: 0,
    ...over,
  })

  test('唯一命中 → 更新 offset、matched', () => {
    const text = 'aaa the quick brown fox bbb'
    const r = reanchorAnnotationOffset(text, anno({ offset: 999 }))
    expect(r.matched).toBe(true)
    expect(r.offset).toBe(4)
  })

  test('多处命中 → 用 prefix/suffix 消歧到正确那处', () => {
    const text = 'X the quick brown fox first. Y the quick brown fox second.'
    // 第二处的前缀是 "Y "
    const r = reanchorAnnotationOffset(text, anno({ prefix: 'Y ', offset: 0 }))
    expect(r.matched).toBe(true)
    expect(r.offset).toBe(text.indexOf('the quick brown fox', 10))
  })

  test('多处命中、无上下文线索 → 退回就近 offset', () => {
    const text = 'the quick brown fox ... the quick brown fox'
    const second = text.indexOf('the quick brown fox', 5)
    const r = reanchorAnnotationOffset(text, anno({ offset: second - 1 }))
    expect(r.offset).toBe(second)
  })

  test('引文被改写、无上下文线索 → lost（交由孤儿处置）', () => {
    const text = 'the slow green turtle wandered off'
    const r = reanchorAnnotationOffset(text, anno({ offset: 0 }))
    expect(r.matched).toBe(false)
    expect(r.confidence).toBe('lost')
    expect(r.offset).toBe(0)
  })

  test('仅空白/排版变化 → 仍命中（exact，三级匹配兜底）', () => {
    const text = 'aaa the   quick\nbrown   fox bbb'
    const r = reanchorAnnotationOffset(text, anno({ offset: 0 }))
    expect(r.matched).toBe(true)
    expect(r.confidence).toBe('exact')
  })

  test('引文被改写、但前后文完好 → 按上下文重锚（context，待复核）', () => {
    // Quote reworded; the bracketing prefix/suffix survive verbatim.
    const text = 'In the report the slow green turtle was noted here clearly.'
    const r = reanchorAnnotationOffset(
      text,
      anno({ prefix: 'In the report ', suffix: ' was noted here', offset: 999 }),
    )
    expect(r.matched).toBe(true)
    expect(r.confidence).toBe('context')
    // Approximate: lands at/near the quote start (anchor is trimmed, so within a space).
    expect(Math.abs(r.offset - text.indexOf('the slow green turtle'))).toBeLessThanOrEqual(1)
  })

  test('引文被改写、仅前缀幸存 → context，落在前缀之后', () => {
    const text = 'In the report something completely different now.'
    const r = reanchorAnnotationOffset(
      text,
      anno({ prefix: 'In the report ', suffix: '', offset: 999 }),
    )
    expect(r.matched).toBe(true)
    expect(r.confidence).toBe('context')
    expect(Math.abs(r.offset - 'In the report '.length)).toBeLessThanOrEqual(1)
  })

  test('过短的上下文锚点不被信任 → lost（避免误锚）', () => {
    const text = 'a b c d e f g totally unrelated content'
    const r = reanchorAnnotationOffset(
      text,
      anno({ prefix: 'a ', suffix: ' b', offset: 0 }),
    )
    expect(r.matched).toBe(false)
    expect(r.confidence).toBe('lost')
  })
})

describe('稳定文档 id', () => {
  test('GitHub raw URL 规范化（去查询参数、小写、去尾部 /）', () => {
    const a = normalizeUrl('https://raw.githubusercontent.com/Owner/Repo/main/Doc.md?token=abc')
    const b = normalizeUrl('https://raw.githubusercontent.com/owner/repo/main/doc.md/')
    expect(a).toBe('https://raw.githubusercontent.com/owner/repo/main/doc.md')
    // path case is preserved-then-lowercased consistently; query + trailing slash dropped
    expect(normalizeUrl('HTTPS://RAW.GITHUBUSERCONTENT.COM/o/r/m/d.md')).toBe(
      'https://raw.githubusercontent.com/o/r/m/d.md',
    )
    expect(b.endsWith('/')).toBe(false)
  })

  test('同 URL 再次拉取 → 复用已有 id', async () => {
    const first = await saveLocalDocument({
      id: createDocId(),
      sourceType: 'github',
      sourceUrl: 'https://github.com/o/r/blob/main/d.md',
      rawUrl: 'https://raw.githubusercontent.com/o/r/main/d.md',
      title: 'd.md',
      markdownSnapshot: '# v1',
      fingerprint: 'fp1',
    })

    // same logical URL but with query string + different case
    const found = await findLocalDocumentByUrl(
      'https://raw.githubusercontent.com/o/r/main/d.md?ref=x',
    )
    expect(found?.id).toBe(first.id)
  })

  test('createDocumentVersion 登记 parentDocumentId（版本谱系）', async () => {
    const parent = await saveLocalDocument({
      id: createDocId(),
      sourceType: 'github',
      sourceUrl: '',
      rawUrl: 'https://raw.githubusercontent.com/o/r/main/d.md',
      title: 'd.md',
      markdownSnapshot: '# v1',
      fingerprint: 'fp1',
    })

    const child = await createDocumentVersion({
      parentDocumentId: parent.id,
      title: 'd-v2.md',
      markdownSnapshot: '# v2',
      fingerprint: 'fp2',
    })

    expect(child.parentDocumentId).toBe(parent.id)
    // successor never pollutes URL matching (blank rawUrl)
    expect(child.rawUrl).toBe('')
    const stillParent = await findLocalDocumentByUrl(
      'https://raw.githubusercontent.com/o/r/main/d.md',
    )
    expect(stillParent?.id).toBe(parent.id)
  })

  test('getDocumentLineage 按 parentDocumentId 回溯出有序链', async () => {
    const v1 = await saveLocalDocument({
      id: createDocId(),
      sourceType: 'github',
      sourceUrl: '',
      rawUrl: '',
      title: 'd.md',
      markdownSnapshot: '# v1',
      fingerprint: 'fp1',
    })
    const v2 = await createDocumentVersion({
      parentDocumentId: v1.id,
      title: 'd-v2.md',
      markdownSnapshot: '# v2',
      fingerprint: 'fp2',
    })
    const v3 = await createDocumentVersion({
      parentDocumentId: v2.id,
      title: 'd-v3.md',
      markdownSnapshot: '# v3',
      fingerprint: 'fp3',
    })

    const chain = await getDocumentLineage(v3.id)
    expect(chain.map((d) => d.id)).toEqual([v1.id, v2.id, v3.id])
  })

  test.todo('FileSystemFileHandle.isSameEntry 匹配 → 同一文档')
  test.todo('无 handle 环境 + 同名文档 → 人工关联提示')
})
