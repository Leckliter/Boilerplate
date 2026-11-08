/**
 * Dark mode without a flash: this tiny script runs in <head> before the first paint, reads the saved
 * choice (light | dark | system, in localStorage) and sets the `dark` class on <html> (the design
 * tokens switch on `.dark`, packages/ui/src/styles/globals.css). `ThemeSwitch` changes it.
 */
export const THEME_KEY = 'theme';
export type ThemeChoice = 'light' | 'dark' | 'system';

export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
