export function injectH2Foldable(container: HTMLElement) {
  const h2s = Array.from(container.querySelectorAll('h2'))

  h2s.forEach((h2) => {
    if (h2.closest('.md-section')) return

    const parent = h2.parentNode
    if (!parent) return

    const section = document.createElement('section')
    section.className = 'md-section'

    const content = document.createElement('div')
    content.className = 'md-section-content'

    parent.insertBefore(section, h2)
    section.appendChild(h2)

    let next = section.nextSibling
    while (
      next &&
      !(
        next.nodeType === Node.ELEMENT_NODE &&
        (next as Element).matches('h2')
      )
    ) {
      const current = next
      next = next.nextSibling
      content.appendChild(current)
    }

    const toggle = document.createElement('button')
    toggle.className = 'md-fold-btn'
    toggle.type = 'button'
    toggle.textContent = '▾'
    toggle.setAttribute('aria-label', 'Collapse section')
    toggle.setAttribute('aria-expanded', 'true')

    toggle.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const collapsed = content.classList.toggle('collapsed')
      toggle.textContent = collapsed ? '▸' : '▾'
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      toggle.setAttribute(
        'aria-label',
        collapsed ? 'Expand section' : 'Collapse section',
      )
    })

    h2.appendChild(toggle)
    section.appendChild(content)
  })
}
