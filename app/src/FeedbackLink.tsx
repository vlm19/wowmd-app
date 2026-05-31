export default function FeedbackLink(props: { href: string; label: string }) {
  return (
    <a
      className="reader-feedback-link"
      href={props.href}
      target="_blank"
      rel="noreferrer"
      aria-label={props.label}
    >
      <span className="feedback-bubble-icon" aria-hidden="true" />
      <span>{props.label}</span>
    </a>
  )
}
