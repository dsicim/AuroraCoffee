import { useState } from 'react'
import LiquidGlassButton from '../../../shared/components/ui/LiquidGlassButton'
import { downloadOrderPdf } from '../application/orderPdf'

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3v8" />
      <path d="m6.5 7.5 3.5 3.5 3.5-3.5" />
      <path d="M4 14.5v1.25A1.25 1.25 0 0 0 5.25 17h9.5A1.25 1.25 0 0 0 16 15.75V14.5" />
    </svg>
  )
}

export default function OrderPdfDownloadButton({
  orderId,
  label = 'Download Invoice',
  downloadingLabel = 'Preparing invoice',
  variant = 'secondary',
  size = 'compact',
  className = '',
  disabled = false,
  onSuccess,
  onError,
}) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (downloading || disabled) {
      return
    }

    setDownloading(true)

    try {
      const result = await downloadOrderPdf(orderId)

      if (onSuccess) {
        onSuccess(result)
      }
    } catch (downloadError) {
      const message = downloadError instanceof Error
        ? downloadError.message
        : 'Invoice download failed'

      if (onError) {
        onError(message, orderId)
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <LiquidGlassButton
      type="button"
      variant={variant}
      size={size}
      className={className}
      contentClassName="aurora-download-button-label"
      onClick={handleDownload}
      loading={downloading}
      disabled={disabled || !orderId}
      aria-label={`${label} for order ${orderId || ''}`.trim()}
    >
      <DownloadIcon />
      <span>{downloading ? downloadingLabel : label}</span>
    </LiquidGlassButton>
  )
}
