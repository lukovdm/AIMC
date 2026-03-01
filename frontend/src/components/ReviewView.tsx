interface Props {
  imageUrl: string
  onRetake: () => void
  onUse: () => void
}

export default function ReviewView({ imageUrl, onRetake, onUse }: Props) {
  return (
    <div className="review-view">
      <img src={imageUrl} alt="Captured" />
      <div className="review-controls">
        <button onClick={onRetake}>↩ Retake</button>
        <button className="primary" onClick={onUse}>✓ Use photo</button>
      </div>
    </div>
  )
}
