import coffeeSketch from '../assets/coffee-sketch.jpeg'

const beans = [
  {
    top: '6%',
    left: '3%',
    width: 96,
    height: 122,
    rotate: -24,
    opacity: 0.2,
  },
  {
    top: '14%',
    right: '6%',
    width: 108,
    height: 138,
    rotate: 20,
    opacity: 0.14,
  },
  {
    top: '42%',
    left: '2%',
    width: 92,
    height: 116,
    rotate: 32,
    opacity: 0.12,
  },
  {
    top: '60%',
    right: '3%',
    width: 100,
    height: 128,
    rotate: -18,
    opacity: 0.16,
  },
  {
    bottom: '8%',
    left: '10%',
    width: 114,
    height: 146,
    rotate: -30,
    opacity: 0.1,
  },
  {
    bottom: '14%',
    right: '11%',
    width: 86,
    height: 110,
    rotate: 18,
    opacity: 0.1,
  },
]

function CoffeeBean({ style, opacity = 0.5 }) {
  return (
    <img
      aria-hidden="true"
      src={coffeeSketch}
      alt=""
      className="absolute select-none object-contain mix-blend-multiply"
      style={{
        ...style,
        opacity,
        WebkitMaskImage:
          'radial-gradient(circle at center, rgba(0,0,0,0.98) 28%, rgba(0,0,0,0.72) 56%, transparent 88%)',
        maskImage:
          'radial-gradient(circle at center, rgba(0,0,0,0.98) 28%, rgba(0,0,0,0.72) 56%, transparent 88%)',
      }}
    />
  )
}

export default function CoffeeBeanDecor({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {beans.map((bean, index) => (
        <CoffeeBean
          key={index}
          opacity={bean.opacity}
          style={{
            ...bean,
            transform: `rotate(${bean.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
