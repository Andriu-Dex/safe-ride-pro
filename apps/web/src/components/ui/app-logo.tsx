type AppLogoProps = {
  avatarUrl?: string | null;
  initials?: string;
  variant?: 'default' | 'hero';
};

export function AppLogo({
  avatarUrl,
  initials = 'SR',
  variant = 'default',
}: AppLogoProps) {
  if (variant === 'hero') {
    return (
      <div className="brand-lockup brand-lockup-hero">
        <div aria-hidden="true" className="brand-emblem">
          <svg fill="none" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="safeRideShield" x1="14" x2="106" y1="10" y2="108">
                <stop offset="0" stopColor="#9bf7df" />
                <stop offset="0.55" stopColor="#15b7ab" />
                <stop offset="1" stopColor="#0c6a63" />
              </linearGradient>
              <linearGradient id="safeRidePin" x1="52" x2="68" y1="8" y2="34">
                <stop offset="0" stopColor="#eefdf8" />
                <stop offset="1" stopColor="#66d9ca" />
              </linearGradient>
            </defs>
            <path
              d="M60 8 103 25v29c0 29.2-18.3 46.2-43 58C35.3 100.2 17 83.2 17 54V25L60 8Z"
              fill="rgba(4, 23, 25, 0.9)"
              stroke="url(#safeRideShield)"
              strokeWidth="5"
            />
            <path
              d="M60 17c-8.2 0-14.8 6.6-14.8 14.8 0 10.5 14.8 24.5 14.8 24.5S74.8 42.3 74.8 31.8C74.8 23.6 68.2 17 60 17Zm0 20.2a5.4 5.4 0 1 1 0-10.8 5.4 5.4 0 0 1 0 10.8Z"
              fill="url(#safeRidePin)"
            />
            <path
              d="M28 67c13-17.5 47.5-18.9 63.4-8.9"
              stroke="#93f5de"
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d="M34 80.5c15.8-11.6 41.1-11 53.5-3.4"
              stroke="#16cabb"
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d="M37.5 72.5h31.7c5.6 0 8.7-1.4 12-5.4l4.4.7c-2.7 5.8-7.2 9.4-16.3 9.4H37.5"
              fill="#f3fffb"
            />
            <path
              d="M40 71.8c4.5-7.6 13.2-12.6 23-12.6h7.4c8.2 0 13.9 2.5 18.9 8.1"
              stroke="#f3fffb"
              strokeLinecap="round"
              strokeWidth="3.5"
            />
            <circle cx="49" cy="83" fill="#f7fffd" r="4.8" />
            <circle cx="82" cy="83" fill="#f7fffd" r="4.8" />
          </svg>
        </div>
        <div className="brand-wordmark">
          <p className="brand-wordmark-main">SAFE RIDE</p>
          <p className="brand-wordmark-accent">PRO</p>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-lockup">
      <div aria-hidden="true" className="brand-mark">
        {avatarUrl ? (
          <img
            alt=""
            className="brand-mark-image"
            src={avatarUrl}
          />
        ) : (
          initials
        )}
      </div>
      <div>
        <p className="brand-title">SafeRidePro</p>
        <p className="brand-subtitle-sidebar">Movilidad universitaria segura</p>
      </div>
    </div>
  );
}


