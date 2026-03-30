/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        tapajos: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5b8fc',  // texto claro no sidebar
          400: '#6b8af5',  // labels de grupo no sidebar
          500: '#4a6ef0',
          600: '#2563eb',  // item ativo — azul forte
          700: '#1d4ed8',  // hover em botões primários
          800: '#1e3a8a',  // hover em itens do sidebar
          900: '#172554',  // fundo do sidebar
        },
      },
    },
  },
  plugins: [],
}
