import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 的样式主要在 client/src/tailwind-theme.css 里用 CSS 变量定义，
 * 这里只保留扫描范围，不依赖任何平台预设。
 */
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx,css}'],
} satisfies Config;
