import React from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const [status, setStatus] = React.useState("idle");
  // Prototype panel: input id="gemini-api" placeholder "Enter Gemini API"
  // ("Gemini API:"), persisted to chrome.storage.local {geminiAPI}; model in {model}.
  const [geminiKey, setGeminiKey] = React.useState("");
  const [model, setModel] = React.useState("gemini-2.5-flash");
  // Prototype storage flag (x2 orchestration): chrome.storage.local
  // {isAutoSubmitQuiz} gates the quiz auto-submit chain.
  const [autoSubmitQuiz, setAutoSubmitQuiz] = React.useState(false);
  // Rate-limit retry toggle: chrome.storage.local {geminiAutoRetry},
  // default ON (see shared/gemini.ts withGeminiRetry).
  const [autoRetry, setAutoRetry] = React.useState(true);
  React.useEffect(() => {
    void chrome.storage.local
      .get(["geminiAPI", "model", "isAutoSubmitQuiz", "geminiAutoRetry", "geminiDelaySec"])
      .then((s) => {
        if (typeof s?.geminiAPI === "string") setGeminiKey(s.geminiAPI);
        if (typeof s?.model === "string") setModel(s.model);
        if (typeof s?.isAutoSubmitQuiz === "boolean") setAutoSubmitQuiz(s.isAutoSubmitQuiz);
        if (typeof s?.geminiAutoRetry === "boolean") setAutoRetry(s.geminiAutoRetry);
        if (typeof s?.geminiDelaySec === "number") setDelaySec(String(s.geminiDelaySec));
      });
  }, []);
  const saveAutoSubmitQuiz = async (checked: boolean) => {
    setAutoSubmitQuiz(checked);
    await chrome.storage.local.set({ isAutoSubmitQuiz: checked });
  };
  const saveAutoRetry = async (checked: boolean) => {
    setAutoRetry(checked);
    await chrome.storage.local.set({ geminiAutoRetry: checked });
  };
  // Spacing between Gemini calls inside one assignment run, seconds
  // (storage geminiDelaySec; read live by geminiInterRequestDelayMs).
  const [delaySec, setDelaySec] = React.useState("10");
  const saveGemini = async () => {
    const parsed = Number.parseInt(delaySec, 10);
    const geminiDelaySec = Number.isFinite(parsed)
      ? Math.max(0, Math.min(parsed, 300))
      : 10;
    await chrome.storage.local.set({ geminiAPI: geminiKey, model, geminiDelaySec });
    setStatus("gemini: key+model+delay saved");
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
        v1: skip video/reading + discussing. v2: submit assignment + request grading
        + auto peer review. 1:1 logic, full logs in console.
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
      </button>{" "}
      <button onClick={() => void run("review-peers")}>
        Auto grade (peer review)
      </button>
      <br /><br />
      <button onClick={() => void run("submit-text-assignment")}>
        Fill assignment (Gemini)
      </button>{" "}
      <button onClick={() => void run("auto-quiz")}>
        Auto answer quiz (Gemini)
      </button>
      <p style={{ margin: "4px 0 0", color: "#555", fontSize: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={autoSubmitQuiz}
            onChange={(e) => void saveAutoSubmitQuiz(e.target.checked)}
          />{" "}
          Auto submit quiz (tắt = chỉ điền, tự nộp tay)
        </label>
      </p>
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
        <label htmlFor="gemini-delay">Delay giữa các câu (giây): </label>
        <input
          id="gemini-delay"
          type="number"
          min={0}
          max={300}
          value={delaySec}
          onChange={(e) => setDelaySec(e.target.value)}
          style={{ width: "100%", margin: "4px 0" }}
        />
        <button onClick={() => void saveGemini()}>Save key</button>
        <p style={{ margin: "6px 0 0", color: "#555", fontSize: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={autoRetry}
              onChange={(e) => void saveAutoRetry(e.target.checked)}
            />{" "}
            Tự retry khi Gemini rate limit (429)
          </label>
        </p>
      </div>
      <p>Status: {status}</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
