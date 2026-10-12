import React from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const [status, setStatus] = React.useState("idle");
  // Prototype panel: input id="gemini-api" placeholder "Enter Gemini API"
  // ("Gemini API:"), persisted to chrome.storage.local {geminiAPI}; model in {model}.
  const [geminiKey, setGeminiKey] = React.useState("");
  const [model, setModel] = React.useState("gemini-2.5-flash");
  React.useEffect(() => {
    void chrome.storage.local.get(["geminiAPI", "model"]).then((s) => {
      if (typeof s?.geminiAPI === "string") setGeminiKey(s.geminiAPI);
      if (typeof s?.model === "string") setModel(s.model);
    });
  }, []);
  const saveGemini = async () => {
    await chrome.storage.local.set({ geminiAPI: geminiKey, model });
    setStatus("gemini: key+model saved");
  };
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
      <br /><br />
      <button onClick={() => void run("submit-text-assignment")}>
        Fill answer (Gemini)
      </button>
      <p style={{ margin: "4px 0 0", color: "#555", fontSize: 12 }}>
        Fill-only: review content, then Save draft → honor → Submit by hand.
      </p>
      <div style={{ marginTop: 12 }}>
        <label htmlFor="gemini-api">Gemini API: </label>
        <input
          id="gemini-api"
          type="text"
          placeholder="Enter Gemini API"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          style={{ width: "100%", margin: "4px 0" }}
        />
        <label htmlFor="gemini-model">Model: </label>
        <input
          id="gemini-model"
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{ width: "100%", margin: "4px 0" }}
        />
        <button onClick={() => void saveGemini()}>Save key</button>
      </div>
      <p>Status: {status}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
