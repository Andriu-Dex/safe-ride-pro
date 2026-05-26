---
name: Academic Transit System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f88'
  primary: '#002045'
  on-primary: '#ffffff'
  primary-container: '#1a365d'
  on-primary-container: '#86a0cd'
  inverse-primary: '#adc7f7'
  secondary: '#0061a5'
  on-secondary: '#ffffff'
  secondary-container: '#66affe'
  on-secondary-container: '#004172'
  tertiary: '#002617'
  on-tertiary: '#ffffff'
  tertiary-container: '#003e28'
  on-tertiary-container: '#00b47d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#adc7f7'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#2d476f'
  secondary-fixed: '#d2e4ff'
  secondary-fixed-dim: '#9fcaff'
  on-secondary-fixed: '#001d37'
  on-secondary-fixed-variant: '#00497e'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin-desktop: 40px
  container-margin-mobile: 20px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style
The design system is engineered for a university carpooling ecosystem where security and efficiency are paramount. The brand personality is **Academic Professional**, blending the reliability of an institutional tool with the modern energy of a peer-to-peer network.

The visual style follows a **Corporate / Modern** approach with a focus on high legibility and structured information density. We prioritize clarity over decoration to ensure students and faculty can coordinate rides quickly under time constraints. The emotional goal is to evoke a sense of "vetted community" and "environmental stewardship" through a clean, systematic interface that feels like a natural extension of the university's digital infrastructure.

## Colors
This design system utilizes a palette rooted in institutional trust and active engagement:

- **Primary (Academic Navy):** Used for headers, primary navigation, and critical brand moments. It conveys stability and authority.
- **Secondary (Campus Blue):** Applied to primary actions (buttons), active selections, and key interactive elements.
- **Tertiary (Emerald Green):** Specifically reserved for "Active" states, verified badges, successful transactions, and "Ride in Progress" indicators.
- **Neutral (Slate):** Used for typography, borders, and secondary iconography to maintain a professional, balanced hierarchy.

The background uses a high-tint off-white (`#F8FAFC`) to reduce eye strain during frequent use, while the default color mode is light to maximize readability in outdoor, daylight conditions common for carpooling.

## Typography
We utilize **Inter** across all levels for its exceptional legibility and systematic feel. The type hierarchy is intentionally tight to allow for data-heavy views like ride schedules and transaction histories. 

- **Headlines:** Use tighter letter-spacing and heavier weights to create a sense of structural importance.
- **Body Text:** Standard weight (400) with generous line-height to ensure accessibility for users on the move.
- **Labels:** Used for status badges (e.g., "MATCHED", "ARRIVING") and metadata, often employing a medium or semi-bold weight to distinguish them from body content.

## Layout & Spacing
The design system employs a **Fluid Grid** model based on an 8px square-grid system. 

- **Desktop:** 12-column grid with 24px gutters. Content is centered in a maximum 1280px container.
- **Mobile:** 4-column grid with 16px gutters and 20px side margins.
- **Spacing Logic:** Vertical rhythm is maintained using "Stack" variables. Use `stack-sm` for related label/input pairs, `stack-md` for items within a list, and `stack-lg` for separating distinct sections or cards. 

The layout prioritizes a "Map-First" or "List-First" reflow depending on the user's current intent (finding a ride vs. managing their profile).

## Elevation & Depth
To maintain a professional and clean aesthetic, this design system uses **Tonal Layers** combined with **Low-contrast outlines**. 

- **Level 0 (Surface):** The main background (`#F8FAFC`).
- **Level 1 (Cards/Containers):** Pure white (`#FFFFFF`) with a 1px solid border in a soft neutral (`#E2E8F0`). 
- **Interactive Depth:** Only the primary action buttons and active ride-tracking cards receive a subtle ambient shadow (4px blur, 10% opacity, navy tint) to indicate they are "above" the static content.

Map elements should use a slight 2px inner-glow to distinguish the map viewport from the surrounding UI chrome.

## Shapes
We adopt a **Rounded** shape language to soften the institutional feel and make the app feel approachable. 

- **Standard Elements:** Buttons, input fields, and ride cards use a 0.5rem (8px) corner radius.
- **Large Containers:** Modal sheets and main dashboard sections use 1rem (16px) for a modern, mobile-friendly feel.
- **Badges/Chips:** Use a fully rounded (pill) style to distinguish them from interactive buttons.

## Components
- **Buttons:** Primary buttons use the Secondary Blue with white text. "Request Ride" buttons should be prominent and full-width on mobile.
- **Status Badges:** Use the Pill shape. "Verified Student" badges use the Primary Navy with a small check icon; "Active Ride" uses the Tertiary Emerald Green.
- **Ride Cards:** White surface with 1px border. Should include the driver's profile photo (circular), vehicle details, and a clear "Seats Available" count.
- **Wallet Transaction Lists:** Clean rows with `body-md` text. Incoming credits are marked with the Tertiary Green; outgoing payments are in Primary Navy.
- **Rating Stars:** Use a specific "Gold" accent (`#F59E0B`) to distinguish from the functional blue/navy/green palette.
- **Maps:** Use a custom-styled map skin that desaturates background geography to highlight the Primary Navy routes and Tertiary Green "Active" vehicle pins.
- **Inputs:** Focused states must use a 2px Secondary Blue border to ensure high visibility for accessibility.