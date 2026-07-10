import React from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import Home from "../app/page";

document.documentElement.lang = "fa";
document.documentElement.dir = "rtl";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
);
