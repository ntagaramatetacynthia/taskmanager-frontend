module.exports = {
  plugins: {
    // Tailwind CSS v4 moved the PostCSS plugin into its own package.
    // Use '@tailwindcss/vite' instead if you prefer the Vite plugin route.
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
