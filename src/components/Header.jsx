import { Link } from 'react-router-dom'
import auroraLogo from '../assets/aurora-logo.jpeg'

const navItems = ['Shop', 'Subscriptions', 'Our Story', 'Contact']

export default function Header() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <Link to="/" className="flex items-center">
        <img
          src={auroraLogo}
          alt="Aurora Coffee Roastery logo"
          className="h-24 w-24 rounded-full object-cover shadow-[0_10px_28px_rgba(95,58,43,0.12)] md:h-28 md:w-28"
        />
      </Link>

      <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--aurora-text)] md:flex">
        {navItems.map((item) => (
          <a
            key={item}
            href="#"
            className="transition hover:text-[var(--aurora-olive-deep)]"
          >
            {item}
          </a>
        ))}
      </nav>

      <Link
        to="/login"
        className="rounded-full border border-[var(--aurora-sky)] bg-[var(--aurora-sky)] px-5 py-3 text-sm font-semibold text-[var(--aurora-cream)] shadow-[0_10px_30px_rgba(144,180,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--aurora-sky-deep)]"
      >
        Login
      </Link>
    </header>
  )
}
