export default function ProductCard({ product }) {
  return (
    <article className="rounded-[2rem] border border-[var(--aurora-border)] bg-[rgba(255,247,242,0.92)] p-6 shadow-[0_20px_60px_rgba(140,84,60,0.08)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--aurora-olive-deep)]">
            {product.roast}
          </p>
          <h3 className="mt-2 font-display text-2xl text-[var(--aurora-text-strong)]">
            {product.name}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--aurora-olive-soft)] px-3 py-1 text-xs font-semibold text-[var(--aurora-olive-deep)]">
          {product.stock} in stock
        </span>
      </div>

      <p className="text-sm leading-7 text-[var(--aurora-text)]">
        {product.description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {product.notes.map((note) => (
          <span
            key={note}
            className="rounded-full border border-[rgba(122,130,96,0.34)] bg-[rgba(223,227,209,0.28)] px-3 py-1 text-xs text-[var(--aurora-olive-deep)]"
          >
            {note}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="font-display text-3xl text-[var(--aurora-text-strong)]">
          {product.price}
        </p>
        <button className="rounded-full border border-[#d89270] bg-[var(--aurora-primary)] px-4 py-2 text-sm font-semibold text-[var(--aurora-text-strong)] shadow-[0_10px_24px_rgba(235,176,144,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-primary-soft)]">
          Add to cart
        </button>
      </div>
    </article>
  )
}
