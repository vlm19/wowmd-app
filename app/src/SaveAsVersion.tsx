import { useState } from 'react'
import type { OpenDocument } from './types'

type Props = {
  document: OpenDocument
  onSaved: (newFilename: string) => void
  onClose: () => void
}

const VERSION_REGEX = /-v(\d+)\.md$/i

function nextVersionFilename(name: string) {
  const match = name.match(VERSION_REGEX)
  if (match) {
    const next = Number(match[1]) + 1
    return name.replace(VERSION_REGEX, `-v${next}.md`)
  }
  const dot = name.lastIndexOf('.')
  if (dot > 0) {
    return `${name.slice(0, dot)}-v2.md`
  }
  return `${name}-v2.md`
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

export default function SaveAsVersion({ document, onSaved, onClose }: Props) {
  const [filename, setFilename] = useState(nextVersionFilename(document.name))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const hasFSH = 'showSaveFilePicker' in ((window as unknown) as Record<string, unknown>)

      if (hasFSH) {
        await saveFileWithFSH(filename, document.markdown)
      } else {
        saveFileWithDownload(filename, document.markdown)
      }

      onSaved(filename)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // user cancelled save dialog
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
        aria-label="Save as new version"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>
        <p className="eyebrow">Save as new version</p>
        <h2>{document.name}</h2>
        <p className="save-version-hint">
          This creates a <strong>new</strong> file and never overwrites the original.
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
            {saving ? 'Saving...' : 'Save new file'}
          </button>
        </div>
      </section>
    </div>
  )
}
