import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (blob: Blob, url: string) => void
}

export default function CameraView({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [camError, setCamError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return }
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
        }
      })
      .catch((err) => {
        if (active) setCamError(String(err?.message ?? err))
      })
    return () => {
      active = false
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(blob, URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.92,
    )
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onCapture(file, URL.createObjectURL(file))
  }

  if (camError) {
    return (
      <div className="camera-view">
        <p className="cam-error">
          Camera unavailable: {camError}
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Choose or take a photo:</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            style={{ color: 'var(--text)' }}
          />
        </label>
      </div>
    )
  }

  return (
    <div className="camera-view">
      <video ref={videoRef} playsInline muted />
      <div className="cam-controls">
        <button className="primary" onClick={capture} disabled={!stream}>
          📷 Capture
        </button>
        <label style={{ cursor: 'pointer' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textDecoration: 'underline' }}>
            Upload file
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  )
}
