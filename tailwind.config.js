// tailwind.config.js
module.exports = {
  content: [
    './resources/views/**/*.blade.php',
    './resources/**/*.blade.php',
    './resources/**/*.js',
    './resources/**/*.vue',
    './storage/framework/views/*.php',
    './public/**/*.html',
  ],
  theme: { extend: {} },
  safelist: [
    // Allocation row backgrounds + hovers
    'bg-amber-50','hover:bg-amber-100/60',
    'bg-violet-50','hover:bg-violet-100/60',
    'bg-emerald-50','hover:bg-emerald-100/60',
    // Left border utilities
    'border-l-4',
    'border-amber-500',
    'border-violet-500',
    'border-emerald-600',
  ],
  plugins: [],
};
