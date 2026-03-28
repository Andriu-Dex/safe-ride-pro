'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLogo } from '../../components/ui/app-logo';
import { useAuth } from '../../modules/auth/hooks/use-auth';
import { LoginForm } from '../../modules/auth/components/login-form';

export default function LoginPage() {
  const router = useRouter();
  const { authSession, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && authSession) {
      router.replace('/dashboard');
    }
  }, [authSession, isHydrated, router]);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-showcase">
          <AppLogo />
          <div>
            <p className="kicker">Portal web MVP</p>
            <h1 className="hero-title">Tu operacion universitaria empieza aqui.</h1>
          </div>
          <p className="hero-text">
            SafeRidePro conecta conductores y pasajeros dentro del contexto institucional, con trazabilidad y una experiencia preparada para crecer modulo por modulo.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <strong>Inicio seguro</strong>
              <p>El login web valida credenciales reales contra el API y mantiene la sesion del usuario.</p>
            </div>
            <div className="feature-item">
              <strong>Panel autenticado</strong>
              <p>El layout protegido ya muestra contexto institucional, navegacion base y cierre de sesion.</p>
            </div>
            <div className="feature-item">
              <strong>Base lista para crecer</strong>
              <p>Desde aqui podemos conectar conductor, vehiculos, viajes, solicitudes y auditoria sin rehacer la interfaz.</p>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

