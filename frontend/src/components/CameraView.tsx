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

  return (
    <div className="camera-view">
      {camError ? (
        <div className="cam-error-overlay">
          <span className="cam-error-icon">📷</span>
          <p className="cam-error-text">Camera unavailable</p>
          <p className="cam-error-detail">{camError}</p>
        </div>
      ) : (
        <video ref={videoRef} playsInline muted className="camera-feed" />
      )}

      {/* Bottom controls */}
      <div className="camera-controls">
        <label className="cam-upload-btn" title="Upload image">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Upload</span>
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </label>

        <button
          className="cam-shutter-btn"
          onClick={capture}
          disabled={!stream && !camError}
          aria-label="Take photo"
        >
          <span className="cam-shutter-ring" />
        </button>

        <label className="cam-upload-btn" title="Take photo from gallery">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Gallery</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  )
}
