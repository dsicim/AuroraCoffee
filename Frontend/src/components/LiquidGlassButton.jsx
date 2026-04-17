import { createElement, forwardRef } from 'react'

const variantClassMap = {
  primary: 'button-variant-primary',
  secondary: 'button-variant-secondary',
  quiet: 'button-variant-quiet',
  soft: 'button-variant-soft',
  danger: 'button-variant-danger',
  chip: 'button-variant-chip',
  icon: 'button-variant-icon',
  stepper: 'button-variant-stepper',
}

const sizeClassMap = {
  hero: 'button-size-hero',
  default: 'button-size-default',
  compact: 'button-size-compact',
  icon: 'button-size-icon',
  stepper: 'button-size-stepper',
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

const LiquidGlassButton = forwardRef(function LiquidGlassButton({
  as = 'button',
  variant = 'primary',
  size = 'default',
  iconOnly = false,
  loading = false,
  selected = false,
  disabled = false,
  className = '',
  contentClassName = '',
  children,
  ...props
}, ref) {
  const Tag = as
  const isButtonElement = as === 'button'
  const isDisabled = disabled || loading
  const wrapperClassName = joinClasses(
    'button-wrap',
    variantClassMap[variant] || variantClassMap.primary,
    sizeClassMap[size] || sizeClassMap.default,
    iconOnly ? 'is-icon-only' : '',
    selected ? 'is-selected' : '',
    isDisabled ? 'is-disabled' : '',
    className,
  )

  const controlProps = {
    ...props,
    className: 'liquid-glass-control',
  }

  if (isButtonElement) {
    controlProps.type = props.type || 'button'
    controlProps.disabled = isDisabled
  } else if (isDisabled) {
    const originalOnClick = props.onClick
    controlProps['aria-disabled'] = 'true'
    controlProps.tabIndex = -1
    controlProps.onClick = (event) => {
      event.preventDefault()
      if (originalOnClick) {
        originalOnClick(event)
      }
    }
  }

  return (
    <div className={wrapperClassName}>
      {createElement(
        Tag,
        {
          ...controlProps,
          ref,
        },
        <span className={joinClasses('button-label', contentClassName)}>
          {children}
        </span>,
      )}
      <div className="button-shadow" />
    </div>
  )
})

export default LiquidGlassButton

export const LiquidGlassIconButton = forwardRef(function LiquidGlassIconButton(props, ref) {
  return (
    <LiquidGlassButton
      ref={ref}
      variant="icon"
      size="icon"
      iconOnly
      {...props}
    />
  )
})

export const LiquidGlassStepperButton = forwardRef(function LiquidGlassStepperButton(props, ref) {
  return (
    <LiquidGlassButton
      ref={ref}
      variant="stepper"
      size="stepper"
      iconOnly
      {...props}
    />
  )
})
