export default function Footer() {
  return (
    <footer
      id="footer"
      className="border-t border-[var(--aurora-border)] px-6 py-8 text-sm text-[var(--aurora-text)] lg:px-10"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p>Aurora Coffee Roastery. Small-batch coffees with a calm, modern storefront.</p>
        <p>Built for slower mornings, cleaner brews, and an easy path back to the coffees you love.</p>
      </div>
    </footer>
  )
}
