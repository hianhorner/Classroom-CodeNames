import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AppTopBarLink = {
  label: string;
  to?: string;
  active?: boolean;
};

type AppTopBarProps = {
  brand?: string;
  variant?: 'surface' | 'dim';
  links?: AppTopBarLink[];
  rightSlot?: ReactNode;
};

export function AppTopBar({
  brand = 'Home',
  variant = 'dim',
  links = [],
  rightSlot
}: AppTopBarProps) {
  return (
    <header className={`app-topbar app-topbar--${variant}`}>
      <div className="app-topbar__brand-group">
        <Link to="/" className="app-topbar__brand">
          {brand}
        </Link>
        {links.length ? (
          <nav className="app-topbar__nav" aria-label="Primary">
            {links.map((link) =>
              link.to ? (
                <Link
                  key={`${link.label}-${link.to}`}
                  to={link.to}
                  className={`app-topbar__link ${link.active ? 'app-topbar__link--active' : ''}`}
                >
                  {link.label}
                </Link>
              ) : (
                <span
                  key={link.label}
                  className={`app-topbar__link ${link.active ? 'app-topbar__link--active' : ''}`}
                >
                  {link.label}
                </span>
              )
            )}
          </nav>
        ) : null}
      </div>
      <div className="app-topbar__side">{rightSlot}</div>
    </header>
  );
}
