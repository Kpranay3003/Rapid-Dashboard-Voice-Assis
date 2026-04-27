/**
 * FloatingAssistant.jsx
 * Bottom-right floating widget:
 *   🎤 Voice  — STT + TTS, auto-opens nodes, reads LIVE data
 *   🤖 Chat   — AI chatbot (Anthropic API)
 *
 * FIX: voice now fetches summary LIVE from the API at the moment
 * you speak, so it always reads real numbers, never stale zeros.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import "./FloatingAssistant.css";
import { getSummary } from "../services/api";

/* ─── helpers ─────────────────────────────────────────────── */
const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

function matchNode(transcript, nodes) {
  const t = norm(transcript);
  // exact id match first
  for (const n of nodes) {
    if (t.includes(norm(n.id))) return n.id;
  }
  // fuzzy label word-overlap
  let best = null, bestScore = 0;
  for (const n of nodes) {
    const words   = norm(n.label.replace(/\n/g, " ")).split(" ").filter(w => w.length > 2);
    const matches = words.filter(w => t.includes(w));
    const score   = words.length ? matches.length / words.length : 0;
    if (score > bestScore && score >= 0.3) { bestScore = score; best = n.id; }
  }
  return best;
}

/* ─── component ───────────────────────────────────────────── */
export default function FloatingAssistant({
  nodesConfig, summaryMap, selectedNode, currentSummary, onNodeSelect,
}) {
  const [open,         setOpen]         = useState(false);
  const [tab,          setTab]          = useState("chat");

  /* voice */
  const [listening,    setListening]    = useState(false);
  const [transcript,   setTranscript]   = useState("");
  const [voiceReply,   setVoiceReply]   = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const recognitionRef = useRef(null);
  const synthRef       = useRef(window.speechSynthesis);

  /* chat */
  const [messages,     setMessages]     = useState([
    { role: "assistant", text: "Hi! I'm your dashboard assistant. Ask me anything about the nodes, or say \"open WMS replication\" to navigate." }
  ]);
  const [input,        setInput]        = useState("");
  const [chatLoading,  setChatLoading]  = useState(false);
  const chatEndRef = useRef(null);

  /* ── init STT ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttSupported(false); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e) => {
      let interim = "", final = "";
      for (const r of e.results) {
        if (r.isFinal) final   += r[0].transcript;
        else           interim += r[0].transcript;
      }
      setTranscript(final || interim);
      if (final) handleVoiceCommand(final);
    };
    rec.onend   = () => setListening(false);
    rec.onerror = (e) => { setListening(false); setVoiceReply("Mic error: " + e.error); };
    recognitionRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── speak ── */
  const speak = useCallback((text) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1; utt.pitch = 1; utt.volume = 1;
    const voices = synth.getVoices();
    const v = voices.find(v => v.name.includes("Google") || v.lang === "en-US");
    if (v) utt.voice = v;
    synth.speak(utt);
    setVoiceReply(text);
  }, []);

  /* ── FIXED: voice command handler — fetches LIVE summary ── */
  const handleVoiceCommand = useCallback(async (text) => {
    const t = norm(text);

    /* stop */
    if (t.includes("stop") || t.includes("close")) {
      speak("Stopped."); return;
    }

    /* list nodes */
    if (t.includes("list") || t.includes("available")) {
      speak("Available nodes: " + nodesConfig.map(n => n.label.replace(/\n/g, " ")).join(", "));
      return;
    }

    /* "how many failed / summary / status" — use currently selected node */
    if (t.includes("how many") || t.includes("summary") || t.includes("status")) {
      if (!selectedNode) {
        speak("Please open a node first, or say the node name."); return;
      }
      setVoiceLoading(true);
      try {
        const s = await getSummary(selectedNode);          // ← LIVE fetch
        const label = nodesConfig.find(n => n.id === selectedNode)?.label.replace(/\n/g, " ") || selectedNode;
        speak(`${label}: total ${s.total ?? 0}, success ${s.success ?? 0}, failed ${s.failed ?? 0}.`);
      } catch {
        speak("Could not fetch summary. Is the backend running?");
      }
      setVoiceLoading(false);
      return;
    }

    /* open / show a node — match then fetch LIVE summary */
    const nodeId = matchNode(text, nodesConfig);
    if (nodeId) {
      const label = nodesConfig.find(n => n.id === nodeId)?.label.replace(/\n/g, " ") || nodeId;
      setVoiceLoading(true);
      try {
        const s = await getSummary(nodeId);                // ← LIVE fetch
        const total   = s.total   ?? 0;
        const success = s.success ?? 0;
        const failed  = s.failed  ?? 0;
        speak(`Opening ${label}. Total: ${total.toLocaleString()}, Success: ${success.toLocaleString()}, Failed: ${failed.toLocaleString()}.`);
        onNodeSelect(nodeId);
      } catch {
        speak(`Opening ${label}, but could not fetch summary.`);
        onNodeSelect(nodeId);
      }
      setVoiceLoading(false);
    } else {
      speak(`No match for "${text}". Try saying a node name like WMS replication or SAP delivery.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesConfig, selectedNode, onNodeSelect, speak]);

  /* ── toggle mic ── */
  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) { rec.stop(); setListening(false); }
    else {
      setTranscript(""); setVoiceReply("");
      try { rec.start(); setListening(true); } catch (e) { console.error(e); }
    }
  };

  /* ── send chat ── */
  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput("");
    const userMsg = { role: "user", text };
    const history = [...messages, userMsg];
    setMessages(history);
    setChatLoading(true);

    const nodeList = nodesConfig.map(n =>
      `- ${n.label.replace(/\n/g, " ")} (id: "${n.id}")`
    ).join("\n");
    const summaryContext = Object.entries(summaryMap).map(([id, s]) =>
      `${id}: total=${s.total ?? 0}, success=${s.success ?? 0}, failed=${s.failed ?? 0}`
    ).join("; ");

    const systemPrompt = `You are an intelligent assistant for a supply-chain Rapid Dashboard.
Nodes in the flow:
${nodeList}

Live summary data: ${summaryContext || "not loaded yet"}
Currently selected node: ${selectedNode || "none"}
${selectedNode && currentSummary ? `Selected node: total=${currentSummary.total}, success=${currentSummary.success}, failed=${currentSummary.failed}` : ""}

Answer questions about the dashboard concisely.
If the user wants to open/navigate to a node, include exactly: OPEN_NODE:<node_id>`;

    try {
      const apiMessages = history.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }));

      // Call YOUR backend /api/chat — which securely proxies to Anthropic
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          messages: apiMessages,
        }),
      });

      const data = await res.json();

      // Handle Anthropic API errors (e.g. invalid key, quota exceeded)
      if (data.error) {
        const errMsg = typeof data.error === "string" ? data.error : data.error?.message || "API error";
        setMessages(prev => [...prev, { role: "assistant", text: `⚠️ ${errMsg}` }]);
        setChatLoading(false);
        return;
      }

      const replyText = data.content?.map(c => c.text || "").join("") || "Sorry, I could not respond.";

      const openMatch = replyText.match(/OPEN_NODE:([^\s\n]+)/);
      if (openMatch) {
        const nodeId = openMatch[1].trim();
        onNodeSelect(nodeId);
        const cleanReply = replyText.replace(/OPEN_NODE:[^\s\n]+/, "").trim() || `Opening ${nodeId}…`;
        setMessages(prev => [...prev, { role: "assistant", text: cleanReply }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: replyText }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: "❌ Could not reach the backend. Make sure you ran: node server.cjs"
      }]);
    }
    setChatLoading(false);
  }, [input, messages, chatLoading, nodesConfig, summaryMap, selectedNode, currentSummary, onNodeSelect]);

  /* ── render ── */
  return (
    <div className="fa-root">
      {open && (
        <div className="fa-panel">
          {/* header / tabs */}
          <div className="fa-panel-header">
            <div className="fa-tabs">
              <button className={`fa-tab ${tab === "chat"  ? "fa-tab--active" : ""}`} onClick={() => setTab("chat")}>🤖 AI Chat</button>
              <button className={`fa-tab ${tab === "voice" ? "fa-tab--active" : ""}`} onClick={() => setTab("voice")}>🎤 Voice</button>
            </div>
            <button className="fa-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* ── CHAT ── */}
          {tab === "chat" && (
            <div className="fa-chat">
              <div className="fa-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`fa-msg fa-msg--${m.role}`}>
                    {m.role === "assistant" && <span className="fa-msg-avatar">🤖</span>}
                    <div className="fa-msg-bubble">{m.text}</div>
                    {m.role === "user" && <span className="fa-msg-avatar">👤</span>}
                  </div>
                ))}
                {chatLoading && (
                  <div className="fa-msg fa-msg--assistant">
                    <span className="fa-msg-avatar">🤖</span>
                    <div className="fa-msg-bubble fa-typing"><span /><span /><span /></div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="fa-input-row">
                <input
                  className="fa-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Ask about nodes, failures…"
                />
                <button className="fa-send-btn" onClick={sendChat} disabled={chatLoading}>➤</button>
              </div>
            </div>
          )}

          {/* ── VOICE ── */}
          {tab === "voice" && (
            <div className="fa-voice">
              {!sttSupported ? (
                <div className="fa-unsupported">⚠️ Voice not supported. Use Chrome or Edge.</div>
              ) : (
                <>
                  <button
                    className={`fa-mic-big ${listening ? "fa-mic-big--active" : ""} ${voiceLoading ? "fa-mic-big--loading" : ""}`}
                    onClick={toggleMic}
                    disabled={voiceLoading}
                  >
                    <span className="fa-mic-icon">
                      {voiceLoading ? "⏳" : listening ? "⏹" : "🎤"}
                    </span>
                    <span className="fa-mic-label">
                      {voiceLoading ? "Fetching data…" : listening ? "Listening… tap to stop" : "Tap to speak"}
                    </span>
                    {listening && !voiceLoading && <span className="fa-pulse" />}
                  </button>

                  {transcript && (
                    <div className="fa-voice-row">
                      <div className="fa-voice-label">You said</div>
                      <div className="fa-voice-text">{transcript}</div>
                    </div>
                  )}
                  {voiceReply && (
                    <div className="fa-voice-row">
                      <div className="fa-voice-label">Assistant replied</div>
                      <div className="fa-voice-text fa-voice-reply">{voiceReply}</div>
                    </div>
                  )}

                  <div className="fa-hints">
                    <strong>Try saying:</strong><br />
                    "open WMS replication"<br />
                    "show SAP delivery"<br />
                    "how many failed"<br />
                    "list nodes"
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        className={`fa-fab ${open ? "fa-fab--open" : ""} ${listening ? "fa-fab--listening" : ""}`}
        onClick={() => setOpen(o => !o)}
        title="Open Assistant"
      >
        {listening ? "🎤" : open ? "✕" : "💬"}
      </button>
    </div>
  );
}
