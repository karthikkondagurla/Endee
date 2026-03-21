import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#380fbd",
                "background-light": "#f3f4f6",
                "background-dark": "#141022",
                "card-light": "#ffffff",
                "card-dark": "#1e1a2e",
                "tag-tech": "#DBEAFE",
                "tag-tech-text": "#1E40AF",
                "tag-finance": "#D1FAE5",
                "tag-finance-text": "#065F46",
                "tag-raw": "#FEE2E2",
                "tag-raw-text": "#991B1B",
                "tag-policy": "#FEF3C7",
                "tag-policy-text": "#92400E",
            },
            fontFamily: {
                "display": ["Space Grotesk", "sans-serif"],
                "body": ["Satoshi", "sans-serif"],
                "mono": ["JetBrains Mono", "monospace"],
            },
            borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
            boxShadow: {
                "subtle": "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                "float": "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }
        },
    },
    plugins: [],
};
export default config;
