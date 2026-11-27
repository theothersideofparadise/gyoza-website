module.exports = {
    theme: {
      extend: {
        colors: {
          wood: { 50: '#f6efe9', 100: '#e8d9cb', 300: '#a8795a', 500: '#6b4529', 700: '#4a2e1a', 900: '#2b1a0f' },
          ember: { 400: '#ec9549', 500: '#e07a22', 600: '#c46216' },
          cream: { 50: '#fffaf2', 100: '#faf3e8', 200: '#f1e5d0' }
        },
        fontFamily: {
          sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
          serif: ['"Noto Serif TC"', 'serif']
        }
      }
    }
  };
module.exports.content = ["./index.html", "./assets/*.js"];
