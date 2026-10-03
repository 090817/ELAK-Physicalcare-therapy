export default function SceneText({ text, className }) {
  const comma = text.indexOf(',')
  if (comma === -1) return <p className={className}>{text}</p>

  return (
    <p className={className}>
      {text.slice(0, comma + 1)}
      <span className="whitespace-nowrap">{text.slice(comma + 1)}</span>
    </p>
  )
}
