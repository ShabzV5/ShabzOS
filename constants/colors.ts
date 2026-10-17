/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#ffffff',
    tint: '#f4eaff',
    background: '#30234b',
    foreground: '#ffffff',
    card: 'rgba(255,255,255,0.16)',
    cardForeground: '#ffffff',
    primary: '#e7ceff',
    primaryForeground: '#3b2859',
    secondary: 'rgba(255,255,255,0.22)',
    secondaryForeground: '#ffffff',
    muted: 'rgba(255,255,255,0.14)',
    mutedForeground: '#eee7f7',
    accent: '#f3e8ff',
    accentForeground: '#35244f',
    destructive: '#ffb4bd',
    destructiveForeground: '#40232b',
    border: 'rgba(255,255,255,0.28)',
    input: 'rgba(255,255,255,0.24)',
    glass: 'rgba(55,37,82,0.42)',
    glassLight: 'rgba(255,255,255,0.28)',
    glassBorder: 'rgba(255,255,255,0.44)',
    ink: '#332348',
    lavender: '#d9bdff',
    coral: '#f2c4d0',
    mint: '#c0e9d9',
    gold: '#f3deb0',
    sky: '#c6dfff',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
