import React from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const [status, setStatus] = React.useState("idle");
  const run = async (action: string) => {
    setStatus(`${action}…`);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("no active tab");
      await chrome.tabs.sendMessage(tab.id, { action });
      setStatus(`${action}: sent`);
    } catch (e) {
      console.error(`[error] popup.${action}`, e);
      setStatus(`${action}: ${(e as Error).message}`);
      throw e;
    }
  };
  return (
    <main style={{ width: 320, padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Coursera Clone</h1>
      <p style={{ margin: "0 0 12px", color: "#555" }}>
        v1: skip video/reading + discussing. v2: submit assignment + request grading.
        1:1 logic, full logs in console.
      </p>
      <button onClick={() => void run("skip-video-reading")}>
        Skip videos &amp; readings
      </button>{" "}
      <button onClick={() => void run("skip-discussing")}>
        Skip discussing
      </button>
      <br /><br />
      <button onClick={() => void run("submit-assignment")}>
        Submit assignment
      </button>{" "}
      <button onClick={() => void run("request-grading-by-peer")}>
        Request peer grading
      </button>
      <p>Status: {status}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
