import { useId, useState } from 'react'

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  onClearFeedback,
  className = '',
  disabled = false,
  ...inputProps
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [isVisible, setIsVisible] = useState(false)

  const handleChange = (event) => {
    onChange(event)
    onClearFeedback?.()
  }

  return (
    <div className="block">
      <label className="aurora-field-label" htmlFor={inputId}>
        {label}
      </label>
      <span className="relative block">
        <input
          {...inputProps}
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`aurora-input aurora-password-input ${className}`.trim()}
        />
        <button
          type="button"
          aria-controls={inputId}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          disabled={disabled}
          onClick={() => {
            setIsVisible((currentValue) => !currentValue)
          }}
          className="aurora-password-toggle"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isVisible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.7 10.7a2 2 0 0 0 2.6 2.6" />
                <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 8.5 4.6 9.4 6.1a2 2 0 0 1 0 1.8 14.2 14.2 0 0 1-2.3 3" />
                <path d="M6.6 6.6A14 14 0 0 0 2.6 10a2 2 0 0 0 0 1.9C3.5 13.4 6.8 18 12 18a10.4 10.4 0 0 0 4.1-.8" />
              </>
            ) : (
              <>
                <path d="M2.6 10.1a2 2 0 0 0 0 1.8C3.5 13.4 6.8 18 12 18s8.5-4.6 9.4-6.1a2 2 0 0 0 0-1.8C20.5 8.6 17.2 4 12 4s-8.5 4.6-9.4 6.1Z" />
                <circle cx="12" cy="11" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
    </div>
  )
}
