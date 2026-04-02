import { createElement } from 'react'

export default function LiquidGlassFrame({
  as = 'div',
  className = '',
  contentClassName = '',
  distortionOverlay = false,
  children,
  ...props
}) {
  return createElement(
    as,
    {
      className: `liquid-glass ${className}`.trim(),
      ...props,
    },
    <>
      <div className="glass-filter" />
      {distortionOverlay ? <div className="glass-distortion-overlay" /> : null}
      <div className="glass-overlay" />
      <div className="glass-specular" />
      <div className={`glass-content ${contentClassName}`.trim()}>{children}</div>
    </>,
  )
}
