import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./page.css";
import "./book-figures.css";
import "./trade-form.css";
import "./equity-chart.css";
import "./data-table.css";
import "./listing-list.css";
import "./listing-detail.css";
import "./activity-list.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
