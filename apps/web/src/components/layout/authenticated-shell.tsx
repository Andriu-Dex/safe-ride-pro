'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../../modules/auth/hooks/use-auth';
import { AppLogo } from '../ui/app-logo';
import { Button } from '../ui/button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/conductor', label: 'Conductor' },
  { href: '/vehiculos', label: 'Vehiculos' },
  { href: '/viajes', label: 'Viajes' },
  { href: '/auditoria', label: 'Auditoria' },
] as const;

type AuthenticatedShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { authSession, signOut } = useAuth();

  const defaultMembership = authSession?.user.memberships.find((membership) => membership.isDefault)
    ?? authSession?.user.memberships[0];

  const handleSignOut = (): void => {
    signOut();
    router.replace('/login');
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <AppLogo />

        <section className="sidebar-section">
          <p className="sidebar-label">Navegacion</p>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={[
                    'sidebar-link',
                    isActive ? 'sidebar-link-active' : '',
                  ].filter(Boolean).join(' ')}
                  href={item.href}
                >
                  <span>{item.label}</span>
                  <span>{isActive ? 'Activo' : 'Ir'}</span>
                </Link>
              );
            })}
          </nav>
        </section>

        <section className="sidebar-note">
          <p className="sidebar-label">Estado del MVP</p>
          <strong>Backend operativo</strong>
          <p>Ya puedes autenticarte, consultar tu perfil y revisar auditoria desde el panel web.</p>
        </section>

        <div className="sidebar-spacer" />

        <section className="sidebar-user-card">
          <p className="sidebar-label">Sesion activa</p>
          <strong>{authSession?.user.fullName}</strong>
          <p>{defaultMembership?.institutionName ?? 'Institucion no disponible'}</p>
          <p>{authSession?.user.email}</p>
          <Button variant="secondary" onClick={handleSignOut}>
            Cerrar sesion
          </Button>
        </section>
      </aside>

      <div className="app-content">{children}</div>
    </div>
  );
}

