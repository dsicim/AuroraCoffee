export default function LiquidGlassDefs() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      className="pointer-events-none absolute"
    >
      <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.008"
          numOctaves="2"
          result="noise"
        />
        <feDisplacementMap
          id="glass-displacement-map"
          in="SourceGraphic"
          in2="noise"
          scale="77"
        />
      </filter>
    </svg>
  )
}
