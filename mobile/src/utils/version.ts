/**
 * The app version string, kept here rather than in a repository so screens can
 * show it without pulling in WatermelonDB (and its native module) — the login
 * screen renders before the database is ever touched.
 */
export const APP_VERSION = '0.1.0';

/**
 * Where a farmer's support mail goes. Kept beside the version because a bug
 * report is only useful with both, and the Settings screen shows them together.
 */
export const SUPPORT_EMAIL = 'lethanhthai0805@gmail.com';
