import {
  buildReviewPrivacyPreviewName,
  buildReviewPrivacyWordPreview,
  getDisplayNameWords,
  resolveReviewPrivacySelection,
} from './reviewPrivacy'

const reviewPrivacyColumnOptions = [
  { value: 'full', label: 'Show' },
  { value: 'initials', label: 'Initial Only' },
  { value: 'anonymous', label: 'Hide' },
]

function PreviewChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 7 5 5 5-5" />
    </svg>
  )
}

export default function ReviewPrivacyMatrix({
  displayName,
  selection,
  open,
  disabled = false,
  onToggle,
  onChange,
  onToggleAll,
}) {
  const words = getDisplayNameWords(displayName)
  const resolvedSelection = resolveReviewPrivacySelection(selection, displayName)
  const previewName = buildReviewPrivacyPreviewName(resolvedSelection, displayName)
  const allHidden = words.length > 0 && resolvedSelection.every((mode) => mode === 'anonymous')

  return (
    <div className="aurora-review-privacy-matrix">
      <div className="aurora-review-privacy-summary">
        <span className="aurora-review-privacy-summary-name">{previewName}</span>
        <div className="aurora-review-privacy-summary-actions">
          <button
            type="button"
            className="aurora-review-privacy-summary-button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onToggleAll(allHidden ? 'full' : 'anonymous')
              }
            }}
          >
            {allHidden ? 'Show All' : 'Hide All'}
          </button>
          <button
            type="button"
            className={`aurora-review-privacy-summary-chevron ${open ? 'is-open' : ''}`.trim()}
            disabled={disabled}
            aria-label={open ? 'Collapse name visibility options' : 'Expand name visibility options'}
            aria-expanded={open ? 'true' : 'false'}
            onClick={() => {
              if (!disabled) {
                onToggle(!open)
              }
            }}
          >
            <PreviewChevronIcon />
          </button>
        </div>
      </div>

      {open ? (
        <div className="aurora-review-privacy-panel">
          <div className="aurora-review-privacy-grid aurora-review-privacy-grid-heading">
            {reviewPrivacyColumnOptions.map((option) => (
              <span key={option.value} className="aurora-review-privacy-heading-cell">
                {option.label}
              </span>
            ))}
          </div>

          <div className="aurora-review-privacy-rows">
            {words.map((word, wordIndex) => (
              <div key={`${word}-${wordIndex}`} className="aurora-review-privacy-grid">
                {reviewPrivacyColumnOptions.map((option) => {
                  const selected = resolvedSelection[wordIndex] === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`aurora-review-privacy-cell ${selected ? 'is-selected' : ''}`.trim()}
                      aria-pressed={selected ? 'true' : 'false'}
                      disabled={disabled}
                      onClick={() => {
                        if (!disabled) {
                          onChange(wordIndex, option.value)
                        }
                      }}
                    >
                      {buildReviewPrivacyWordPreview(word, option.value)}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
