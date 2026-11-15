import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

try {
  const saved = localStorage.getItem("finnova_theme");
  document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
