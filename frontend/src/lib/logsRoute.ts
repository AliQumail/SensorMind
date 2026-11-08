const base = import.meta.env.BASE_URL.replace(/\/$/, '')

/** The logs page lives at /logs (under the app's base path) and needs no sign-in. */
export const logsHref = `${base}/logs`
export const appHref = `${base}/`
export const isLogsPath = () => window.location.pathname.replace(/\/$/, '') === logsHref
