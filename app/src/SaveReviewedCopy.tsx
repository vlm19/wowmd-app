import { useState } from 'react'
import type { Annotation } from './annotations'
import { buildObsidianReviewedMarkdown, type ObsidianExportOptions } from './exportObsidian'
import type { OpenDocument } from './types'
import {
  appendFileLineage,
  createLineageDocumentId,
  createLineageId,
} from './fileLineage'

type Props = {
  document: OpenDocument
  annotations: Annotation[]
  onSaved: (result: { newFilename: string; markdown: string }) => void
  onClose: () => void
}

function defaultReviewedFilename(name: string) {
  const dot = name.lastIndexOf('.')
  if (dot > 0) {
    return `${name.slice(0, dot)}-reviewed.md`
  }
  return `${name}-reviewed.md`
}

async function saveFileWithFSH(filename: string, content: string) {
  const handle = await ((window as unknown) as { showSaveFilePicker: (opts: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<{ createWritable: () => Promise<{ write: (content: string) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker({
    suggestedName: filename,
    types: [{
      description: 'Markdown',
      accept: { 'text/markdown': ['.md'] },
    }],
  })

  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
  return true
}

function saveFileWithDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SaveReviewedCopy({ document, annotations, onSaved, onClose }: Props) {
  const [filename, setFilename] = useState(defaultReviewedFilename(document.name))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const options: ObsidianExportOptions = {
        includeProperties: true,
        includeTags: true,
        includeAppendix: true,
        generatedAt: new Date(),
        fingerprint: document.fingerprint,
      }

      const reviewedBody = buildObsidianReviewedMarkdown({
        markdown: document.markdown,
        annotations,
        documentName: document.name,
        options,
      })
      const reviewedMarkdown = await appendFileLineage(reviewedBody, {
        lineageId: document.lineageId || createLineageId(),
        documentId: createLineageDocumentId(),
        parentDocumentId: document.stableId,
        sourceTicketId: document.sourceTicketId,
        originalFilename: document.name,
        savedAt: new Date().toISOString(),
        producer: { app: 'wowMD Pro' },
      })

      const hasFSH = 'showSaveFilePicker' in ((window as unknown) as Record<string, unknown>)

      if (hasFSH) {
        await saveFileWithFSH(filename, reviewedMarkdown)
      } else {
        saveFileWithDownload(filename, reviewedMarkdown)
      }

      onSaved({ newFilename: filename, markdown: reviewedMarkdown })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSaving(false)
        return
      }
      setError('Could not write the file. Try a different filename or location.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="annotation-modal-layer" role="presentation">
      <section
        className="annotation-modal save-version"
        role="dialog"
        aria-modal="true"
        aria-label="Save Obsidian reviewed copy"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>
        <p className="eyebrow">Save Obsidian reviewed copy</p>
        <h2>{document.name}</h2>
        <p className="save-version-hint">
          Creates a new Markdown copy with Obsidian-ready review callouts and portable version identity. The original file is never overwritten.
        </p>

        <label className="save-version-filename">
          <span>New filename</span>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value.trim() || filename)}
          />
        </label>

        {error ? (
          <p className="save-version-error">{error}</p>
        ) : null}

        <div className="modal-actions">
          <button
            className="ghost-action"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={saving || !filename}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save reviewed .md'}
          </button>
        </div>
      </section>
    </div>
  )
}
