import type { Locale } from './i18n'

const localeOptions: Array<{ locale: Locale; label: string; flag: string }> = [
  { locale: 'en', label: 'English', flag: 'gb' },
  { locale: 'zh', label: 'Chinese', flag: 'cn' },
  { locale: 'ja', label: 'Japanese', flag: 'jp' },
  { locale: 'ko', label: 'Korean', flag: 'kr' },
  { locale: 'de', label: 'Deutsch', flag: 'de' },
  { locale: 'fr', label: 'French', flag: 'fr' },
]

export default function LanguagePicker(props: {
  locale: Locale
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  changeLocale: (locale: Locale) => void
}) {
  const activeOption =
    localeOptions.find((option) => option.locale === props.locale) || localeOptions[0]

  return (
    <div className={`language-picker ${props.isOpen ? 'is-open' : ''}`}>
      <button
        className="language-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={props.isOpen}
        aria-label="Language selector"
        onClick={() => props.setIsOpen(!props.isOpen)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            props.setIsOpen(false)
          }
        }}
      >
        <img
          className="flag"
          src={`assets/flags/${activeOption.flag}.svg`}
          alt=""
        />
        <span className="language-arrow" aria-hidden="true" />
      </button>
      <div className="language-menu" role="listbox" hidden={!props.isOpen}>
        {localeOptions.map((option) => (
          <button
            key={option.locale}
            type="button"
            role="option"
            aria-label={option.label}
            aria-selected={props.locale === option.locale}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              props.changeLocale(option.locale)
              props.setIsOpen(false)
            }}
          >
            <img
              className="flag"
              src={`assets/flags/${option.flag}.svg`}
              alt=""
            />
          </button>
        ))}
      </div>
    </div>
  )
}
