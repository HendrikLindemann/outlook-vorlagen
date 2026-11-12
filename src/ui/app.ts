import type { Template } from "../core/model";
import type { Host } from "../host";
import { AuthRequiredError } from "../storage/backends";
import type { Store } from "../storage/store";
import { renderEditor } from "./editor";
import { renderFill } from "./fill";
import { renderList } from "./list";

export type View = { name: "list" } | { name: "fill"; template: Template } | { name: "editor"; template?: Template };

export interface App {
  host: Host;
  store: Store;
  root: HTMLElement;
  notice: string; // Hinweis oben in der Liste, z. B. fehlende Anmeldung
  needsSignIn: boolean;
  search: string;
  go(view: View): void;
  reload(interactive: boolean): Promise<void>;
}

export function createApp(host: Host, store: Store, root: HTMLElement): App {
  let current: View = { name: "list" };
  const app: App = {
    host,
    store,
    root,
    notice: "",
    needsSignIn: false,
    search: "",
    go(view) {
      current = view;
      root.replaceChildren(
        view.name === "list"
          ? renderList(app)
          : view.name === "fill"
            ? renderFill(app, view.template)
            : renderEditor(app, view.template),
      );
      root.scrollTop = 0;
    },
    async reload(interactive) {
      try {
        await store.load(interactive);
        app.notice = "";
        app.needsSignIn = false;
      } catch (e) {
        app.needsSignIn = e instanceof AuthRequiredError;
        app.notice = (e as Error).message;
      }
      if (current.name === "list") app.go(current);
    },
  };
  return app;
}
