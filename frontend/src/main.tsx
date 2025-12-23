import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfills for web3 libraries (Solana, etc.)
import { Buffer } from "buffer";
import process from "process";
// @ts-expect-error - attach to window for browser shims
window.Buffer = Buffer;
// @ts-expect-error - attach to window for browser shims
window.process = process;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
