import coffeeSketch from '../../../assets/coffee-sketch.jpeg'

const bubbles = [
  'left-[7%] top-[72%] h-10 w-10',
  'left-[18%] top-[82%] h-6 w-6',
  'left-[28%] top-[58%] h-8 w-8',
  'left-[42%] top-[86%] h-5 w-5',
  'left-[56%] top-[70%] h-12 w-12',
  'left-[66%] top-[84%] h-7 w-7',
  'left-[79%] top-[62%] h-9 w-9',
  'left-[90%] top-[80%] h-6 w-6',
]

export default function AuroraAtmosphere({
  className = '',
  sketch = false,
  opacityClassName = '',
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${opacityClassName} ${className}`.trim()}
    >
      <div className="aurora-ambient-glow aurora-ambient-glow-cocoa" />
      <div className="aurora-ambient-glow aurora-ambient-glow-slate" />
      <div className="aurora-ambient-glow aurora-ambient-glow-brass" />

      <div className="aurora-bubble-layer">
        {bubbles.map((bubbleClassName, index) => (
          <span
            key={bubbleClassName}
            className={`aurora-bubble-particle ${bubbleClassName}`}
            style={{
              animationDelay: `${index * 1.05}s`,
              animationDuration: `${10.5 + index * 1.15}s`,
            }}
          />
        ))}
      </div>

      {sketch ? (
        <img
          src={coffeeSketch}
          alt=""
          className="absolute right-[7%] top-[10%] h-56 w-44 rotate-[8deg] object-contain opacity-[0.04] mix-blend-soft-light"
        />
      ) : null}
    </div>
  )
}
