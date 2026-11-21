import type { IPublicClientApplication } from "@azure/msal-browser";
import { AuthRequiredError } from "./backends";

const SCOPES = ["Files.ReadWrite.AppFolder"];

/**
 * Anmeldung über Nested App Authentication: Outlook stellt das Token für das
 * bereits angemeldete Konto bereit, ein eigenes Anmeldefenster ist meist unnötig.
 */
export function createTokenProvider(clientId: string, authority: string) {
  let pca: Promise<IPublicClientApplication> | undefined;

  return async function getToken(interactive: boolean): Promise<string> {
    pca ??= import("@azure/msal-browser").then((msal) =>
      msal.createNestablePublicClientApplication({
        auth: { clientId, authority },
        cache: { cacheLocation: "localStorage" },
      }),
    );
    const app = await pca;
    try {
      return (await app.acquireTokenSilent({ scopes: SCOPES })).accessToken;
    } catch (silentError) {
      if (!interactive) {
        throw new AuthRequiredError("Für den Zugriff auf OneDrive ist eine Anmeldung nötig.");
      }
      try {
        return (await app.acquireTokenPopup({ scopes: SCOPES })).accessToken;
      } catch (e) {
        throw new AuthRequiredError(`Anmeldung fehlgeschlagen: ${(e as Error).message || silentError}`);
      }
    }
  };
}
