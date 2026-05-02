import React from 'react';

type NavbarLogoProps = {
  logoUrl?: string;
};

export function NavbarLogo({ logoUrl }: NavbarLogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        <img alt="SafeRidePro" className="w-12 h-12 rounded-xl shadow-sm object-cover" src={logoUrl} />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-bold text-base shadow-sm">
          SR
        </div>
      )}
      <strong className="text-2xl font-extrabold tracking-tight text-white">
        SafeRidePro
      </strong>
    </div>
  );
}