import React from 'react';

import styles from './navbar-logo.module.css';

type NavbarLogoProps = {
  logoUrl?: string;
};

export function NavbarLogo({ logoUrl }: NavbarLogoProps) {
  return (
    <div className={styles.logo}>
      {logoUrl ? (
        <div className={styles.logoMark}>
          <img alt="SafeRidePro" className={styles.logoImage} src={logoUrl} />
        </div>
      ) : (
        <div className={styles.logoMark}>SR</div>
      )}
      <strong className={styles.logoText}>SafeRidePro</strong>
    </div>
  );
}