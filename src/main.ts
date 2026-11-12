import { initHost } from "./host";
import { createStore, loadConfig } from "./storage/store";
import "./styles.css";
import { createApp } from "./ui/app";

async function start() {
  const root = document.getElementById("app")!;
  const [host, config] = await Promise.all([initHost(), loadConfig()]);
  const store = createStore(host, config);
  const app = createApp(host, store, root);
  app.go({ name: "list" }); // zeigt sofort den zwischengespeicherten Stand
  await app.reload(false);
}

start();
