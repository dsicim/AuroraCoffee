import coffeeSketch from '../assets/coffee-sketch.jpeg'

const beans = [
  {
    top: '4%',
    left: '3%',
    width: 108,
    height: 138,
    rotate: -20,
    opacity: 0.18,
  },
  {
    top: '12%',
    right: '4%',
    width: 132,
    height: 166,
    rotate: 18,
    opacity: 0.12,
  },
  {
    top: '36%',
    left: '-1%',
    width: 100,
    height: 128,
    rotate: 34,
    opacity: 0.11,
  },
  {
    top: '54%',
    right: '2%',
    width: 118,
    height: 148,
    rotate: -18,
    opacity: 0.15,
  },
  {
    bottom: '10%',
    left: '8%',
    width: 126,
    height: 160,
    rotate: -28,
    opacity: 0.09,
  },
  {
    bottom: '12%',
    right: '10%',
    width: 92,
    height: 116,
    rotate: 18,
    opacity: 0.1,
  },
  {
    top: '72%',
    left: '42%',
    width: 150,
    height: 190,
    rotate: -12,
    opacity: 0.06,
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
      <div className="absolute left-[-8rem] top-[-5rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(205,154,113,0.22)_0%,rgba(205,154,113,0.1)_34%,transparent_74%)]" />
      <div className="absolute right-[-10rem] top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(134,169,185,0.18)_0%,rgba(134,169,185,0.08)_34%,transparent_74%)]" />
      <div className="absolute bottom-[-9rem] left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(155,123,72,0.14)_0%,rgba(155,123,72,0.06)_34%,transparent_74%)]" />

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
