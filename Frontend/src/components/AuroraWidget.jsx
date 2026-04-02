function IconSvg({ icon }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-5 w-5',
    'aria-hidden': 'true',
  }

  switch (icon) {
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M3 4h2l2.3 10.2a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 7H7.2" />
        </svg>
      )
    case 'account':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.5a7.2 7.2 0 0 1 13 0" />
        </svg>
      )
    case 'orders':
      return (
        <svg {...common}>
          <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V6A1.5 1.5 0 0 1 7 4.5Z" />
          <path d="M8.5 9h7" />
          <path d="M8.5 13h7" />
          <path d="M8.5 17h4" />
        </svg>
      )
    case 'location':
      return (
        <svg {...common}>
          <path d="M12 20s6-4.9 6-10a6 6 0 1 0-12 0c0 5.1 6 10 6 10Z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...common}>
          <path d="m12 20-1.4-1.2C5.4 14.2 3 11.9 3 8.9A4 4 0 0 1 7.1 5c1.7 0 3 .8 3.9 2 1-1.2 2.3-2 4-2A4 4 0 0 1 19 8.9c0 3-2.4 5.3-7.6 9.9Z" />
        </svg>
      )
    case 'coffee':
      return (
        <svg {...common}>
          <path d="M6 8.5h9v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" />
          <path d="M15 9h1.5a2.5 2.5 0 1 1 0 5H15" />
          <path d="M7 4.5c.5.5.7 1 .7 1.7S7.5 7.4 7 8" />
          <path d="M10 4.5c.5.5.7 1 .7 1.7S10.5 7.4 10 8" />
          <path d="M13 4.5c.5.5.7 1 .7 1.7S13.5 7.4 13 8" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" />
          <path d="m18.5 16.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9Z" />
        </svg>
      )
    case 'package':
      return (
        <svg {...common}>
          <path d="m12 3 7 3.8v10.4L12 21l-7-3.8V6.8Z" />
          <path d="m12 3 7 3.8-7 4-7-4Z" />
          <path d="M12 10.8V21" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4.5 19.5h15" />
          <path d="M7.5 16v-4.5" />
          <path d="M12 16V8" />
          <path d="M16.5 16v-7" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.8v3.1" />
          <path d="M12 18.1v3.1" />
          <path d="m4.8 4.8 2.2 2.2" />
          <path d="m17 17 2.2 2.2" />
          <path d="M2.8 12h3.1" />
          <path d="M18.1 12h3.1" />
          <path d="m4.8 19.2 2.2-2.2" />
          <path d="m17 7 2.2-2.2" />
        </svg>
      )
  }
}

export function AuroraInset({ className = '', children }) {
  return <div className={`aurora-widget-subsurface p-4 sm:p-5 ${className}`.trim()}>{children}</div>
}

export default function AuroraWidget({
  title,
  subtitle = '',
  icon = 'spark',
  headerAside = null,
  className = '',
  contentClassName = '',
  children,
}) {
  return (
    <div className={className}>
      <div className="aurora-widget-header">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="aurora-widget-icon">
            <IconSvg icon={icon} />
          </div>
          <div className="aurora-widget-heading">
            <h3 className="aurora-widget-title">{title}</h3>
            {subtitle ? <p className="aurora-widget-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {headerAside ? <div className="aurora-widget-header-aside">{headerAside}</div> : null}
      </div>
      <div className={`aurora-widget-body ${contentClassName}`.trim()}>{children}</div>
    </div>
  )
}
