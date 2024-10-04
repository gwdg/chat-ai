/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#B4388D",
        secondary: "#695EA2",
        tertiary: "#009EE0",
        border_dark: "#333333",
        bg_dark: "#1a1a1a",
        bg_light: "#f3f4f6",
        bg_secondary_dark: "#2B2B2B",
        // bg_chat: "#48c9ff",
        bg_chat: "#e2f0ff",
        bg_chat_dark: "#3B3B3B",
        bg_chat_user: "#fff",
        bg_chat_user_dark: "#2B2B2B",
        bg_reset_default: "#E7E7E7",
        bg_reset_default_pressed: "#D7D7D7",
        disable_textArea: "#737373",
        disable_textArea_light: "#EEEEEE",
      },
      boxShadow: {
        top: "0 -10px 15px -1px rgba(0, 0, 0, 0.1), 0 -4px 6px -4px rgba(0, 0, 0, 0.06)",
        darkTop:
          "0 -10px 15px -1px rgba(0, 0, 0, 0.2), 0 -4px 6px -4px rgba(0, 0, 0, 0.2)",
        dark: "0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)",
        bottom: "0 20px 10px -10px rgba(0, 0, 0, 0.1)", // Focused bottom shadow with no spread
        darkBottom: "0 20px 10px -10px rgba(0, 0, 0, 0.2)", // Focused dark mode bottom shadow with no spread
      },
      screens: {
        mobile: { max: "800px" }, // Under 800px
        middle: { min: "801px", max: "1280px" }, // Between 800px and 1280px
        desktop: { min: "1281px" }, // Above 1280px
      },
      backgroundImage: () => ({
        "logo-large": "url('../src/assets/Gwdg-logo-neu.png')",
        "logo-small": "url('../src/assets/gwdg.png')",
        "kisski-logo-large": "url('../src/assets/kisski.png')",
        "kisski-logo-small": "url('../src/assets/kisski-logo-mobile.png')",
      }),
    },
  },
  plugins: [],
};
