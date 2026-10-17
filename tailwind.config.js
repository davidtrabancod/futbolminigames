module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d'
        },
        arena: {
          yellow: '#facc15',
          orange: '#fb923c',
          blue: '#38bdf8',
          red: '#f87171'
        }
      },
      fontFamily: {
        kids: ['Chakra Petch', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
