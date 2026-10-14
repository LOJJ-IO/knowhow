/** Window events the app's pieces use to reach a dialog they don't own. */

/** Opens Settings (the profile menu owns it): `window.dispatchEvent(new
 *  Event(OPEN_SETTINGS_EVENT))`. */
export const OPEN_SETTINGS_EVENT = "knohow:open-settings";
