export function redirectToLogin(): void {
  if (typeof window === 'undefined' || window.location.pathname === '/login') {
    return;
  }

  window.location.replace('/login');
}
