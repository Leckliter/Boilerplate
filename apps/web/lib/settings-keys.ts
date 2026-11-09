/**
 * Keys of the settings the app's own screens read and write (`settings.get` / `settings.set`). Kept in a
 * plain module (not in a 'use client' file) so server pages and client forms can both import the values.
 */
/** Saved once the owner has seen the welcome wizard on the dashboard. */
export const ONBOARDING_SETTING = 'onboarding.done';
/** The app's name and brand colour, set in Settings → General. */
export const BRAND_NAME_KEY = 'brand.name';
export const BRAND_COLOR_KEY = 'brand.color';
