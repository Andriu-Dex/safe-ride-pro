import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}', // ¡Crucial para que detecte el login!
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;