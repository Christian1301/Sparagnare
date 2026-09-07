/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1B2A3A",
        paper: "#FAF8F2",
        gold: "#C9A227",
        teal: "#2F6F62",
        rust: "#B5473D",
        line: "#EFEBE0",
        muted: "#8A8474",
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};
