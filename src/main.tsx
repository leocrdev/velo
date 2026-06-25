import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ConfigProvider } from "./components/ConfigProvider.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
