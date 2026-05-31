export default function SearchControl(props: {
  t: (key: string) => string
  value: string
  onChange: (value: string) => void
  index: number
  count: number
  previous: () => void
  next: () => void
  disabled?: boolean
}) {
  const hasResults = props.count > 0

  return (
    <div className="search-control" role="search">
      <input
        type="search"
        value={props.value}
        disabled={props.disabled}
        placeholder={props.t('search')}
        aria-label={props.t('search')}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <span className="search-count">
        {props.value.trim() ? (hasResults ? `${props.index + 1}/${props.count}` : `0/0`) : props.t('search')}
      </span>
      <button
        type="button"
        disabled={props.disabled || !hasResults}
        aria-label={props.t('prev')}
        onClick={props.previous}
      >
        -
      </button>
      <button
        type="button"
        disabled={props.disabled || !hasResults}
        aria-label={props.t('next')}
        onClick={props.next}
      >
        +
      </button>
    </div>
  )
}
