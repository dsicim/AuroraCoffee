import { useId, useMemo, useState } from 'react'

const themeOptions = [
  {
    index: '1',
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v2.5" />
        <path d="M12 18.5V21" />
        <path d="m5.64 5.64 1.77 1.77" />
        <path d="m16.59 16.59 1.77 1.77" />
        <path d="M3 12h2.5" />
        <path d="M18.5 12H21" />
        <path d="m5.64 18.36 1.77-1.77" />
        <path d="m16.59 7.41 1.77-1.77" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    index: '2',
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 1 0 9.8 9.8Z" />
      </svg>
    ),
  },
  {
    index: '3',
    value: 'system',
    label: 'Auto',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="11" rx="2" />
        <path d="M9 19h6" />
        <path d="M12 16v3" />
      </svg>
    ),
  },
]

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

export default function LiquidThemeToggle({
  value = 'system',
  onValueChange,
  ariaLabel = 'Choose theme',
  size = 'compact',
  disabled = false,
  className = '',
}) {
  const name = `aurora-theme-toggle-${useId().replace(/:/g, '')}`
  const filterId = `aurora-theme-switcher-filter-${name}`
  const currentOption = useMemo(
    () => themeOptions.find((option) => option.value === value) ?? themeOptions[2],
    [value],
  )
  const [previousOption, setPreviousOption] = useState(currentOption.index)

  return (
    <fieldset
      aria-label={ariaLabel}
      className={joinClasses(
        'switcher',
        'aurora-theme-toggle',
        size === 'panel' ? 'is-panel' : 'is-compact',
        disabled ? 'is-disabled' : '',
        className,
      )}
      c-previous={previousOption}
      style={{ '--switcher-filter': `url(#${filterId})` }}
    >
      <legend className="switcher__legend">{ariaLabel}</legend>

      {themeOptions.map((option) => {
        const checked = option.value === value

        return (
          <label
            key={option.value}
            className={joinClasses(
              'switcher__option',
              'aurora-theme-toggle__option',
              checked ? 'is-active' : '',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              c-option={option.index}
              checked={checked}
              disabled={disabled}
              className="switcher__input aurora-theme-toggle__input"
              onChange={(event) => {
                if (!event.target.checked || disabled) {
                  return
                }

                setPreviousOption(currentOption.index)

                if (typeof onValueChange === 'function') {
                  onValueChange(option.value)
                }
              }}
            />
            <span className="sr-only">{option.label}</span>
            <span className="switcher__icon aurora-theme-toggle__icon" aria-hidden="true">
              {option.icon}
            </span>
          </label>
        )
      })}

      <div className="switcher__filter" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg">
          <filter id={filterId} primitiveUnits="objectBoundingBox">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur" />
            <feDisplacementMap
              in="blur"
              in2="blur"
              scale="0.05"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      </div>
    </fieldset>
  )
}
