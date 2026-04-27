/**
 * FloatingAssistant.jsx
 * Bottom-right floating widget with two tabs:
 *   🎤 Voice  — Speech-to-text + text-to-speech, auto-opens nodes
 *   🤖 Chat   — AI chatbot powered by Anthropic API (Claude)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import "./FloatingAssistant.css";

/* ─── helpers ─────────────────────────────────────────────── */
const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

function matchNode(transcript, nodes) {
  const t = norm(transcript);
  for (const n of nodes) {
    if (t.includes(norm(n.id))) return n.id;
  }
  let best = null, bestScore = 0;
  for (const n of nodes) {
    const words   = norm(n.label).split(" ");
    const matches = words.filter(w => w.length > 2 && t.includes(w));
    const score   = matches.length / words.length;
    if (score > bestScore && score >= 0.3) { bestScore = score; best = n.id; }
  }
  return best;
}

function buildReply(nodeId, nodes, summary) {
  const node  = nodes.find(n => n.id === nodeId);
  const label = node ? node.label.replace(/\n/g, " ") : nodeId;
  const { total = 0, success = 0, failed = 0 } = summary || {};
  return `Opening ${label}. Total: ${total}, Success: ${success}, Failed: ${failed}.`;
}

/* ─── component ───────────────────────────────────────────── */
export default function FloatingAssistant({
  nodesConfig, summaryMap, selectedNode, currentSummary, onNodeSelect,
}) {
  const [open,      setOpen]      = useState(false);
  const [tab,       setTab]       = useState("chat"); // "voice" | "chat"

  /* ── Voice states ── */
  const [listening,   setListening]   = useState(false);
  const [transcript,  setTranscript]  = useState("");
  const [voiceReply,  setVoiceReply]  = useState("");
  const [sttSupported, setSttSupported] = useState(true);
  const recognitionRef = useRef(null);
  const synthRef       = useRef(window.speechSynthesis);

  /* ── Chat states ── */
  const [messages, setMessages] = useState([
  { 
    role: "assistant",
    text: "Hi! I'm your dashboard assistant. Ask me about nodes, transactions, failures, or say \"open [node name]\" to navigate."
  }
]);
  const [input,     setInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  /* ── init STT ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttSupported(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else           interim += r[0].transcript;
      }
      setTranscript(final || interim);
      if (final) handleVoiceCommand(final);
    };
    rec.onend  = () => setListening(false);
    rec.onerror = (e) => { setListening(false); setVoiceReply("Mic error: " + e.error); };
    recognitionRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── scroll chat to bottom ── */
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

  /* ── voice command handler ── */
  const handleVoiceCommand = useCallback((text) => {
    const t = norm(text);
    if (t.includes("stop") || t.includes("close")) { speak("Stopped."); return; }
    if (t.includes("how many") || t.includes("summary") || t.includes("status")) {
      if (selectedNode && currentSummary) {
        const { total=0, success=0, failed=0 } = currentSummary;
        speak(`${selectedNode}: total ${total}, success ${success}, failed ${failed}.`);
      } else { speak("Please open a node first."); }
      return;
    }
    if (t.includes("list") || t.includes("available")) {
      speak("Available nodes: " + nodesConfig.map(n => n.label.replace(/\n/g," ")).join(", "));
      return;
    }
    const nodeId = matchNode(text, nodesConfig);
    if (nodeId) {
      speak(buildReply(nodeId, nodesConfig, summaryMap[nodeId]));
      onNodeSelect(nodeId);
    } else {
      speak(`No match for "${text}". Try saying a node name.`);
    }
  }, [nodesConfig, summaryMap, selectedNode, currentSummary, onNodeSelect, speak]);

  /* ── toggle mic ── */
  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) { rec.stop(); setListening(false); }
    else {
      setTranscript(""); setVoiceReply("");
      try { rec.start(); setListening(true); } catch(e) { console.error(e); }
    }
  };

  /* ── send chat message ── */
  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput("");

    const userMsg = { role: "user", text };
    const history = [...messages, userMsg];
    setMessages(history);
    setChatLoading(true);

    // Build system context about the dashboard
    const nodeList = nodesConfig.map(n =>
      `- ${n.label.replace(/\n/g," ")} (id: "${n.id}")`
    ).join("\n");
    const summaryContext = Object.entries(summaryMap).map(([id, s]) =>
      `${id}: total=${s.total??0}, success=${s.success??0}, failed=${s.failed??0}`
    ).join("; ");

    const systemPrompt = `You are an intelligent assistant for a supply-chain Rapid Dashboard.
The dashboard shows 8 nodes in a flow:
${nodeList}

Current live summary data: ${summaryContext || "not loaded yet"}
Currently selected node: ${selectedNode || "none"}
${selectedNode && currentSummary ? `Selected node summary: total=${currentSummary.total}, success=${currentSummary.success}, failed=${currentSummary.failed}` : ""}

Answer questions about the dashboard, nodes, transactions, anomalies, and supply-chain flow.
If the user wants to open/navigate to a node, reply with exactly: OPEN_NODE:<node_id>
Keep answers concise and helpful.`;

    try {
      const apiMessages = history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const replyText = data.content?.map(c => c.text || "").join("") || "Sorry, I couldn't respond.";

      // Check if AI wants to open a node
      const openMatch = replyText.match(/OPEN_NODE:(.+)/);
      if (openMatch) {
        const nodeId = openMatch[1].trim();
        onNodeSelect(nodeId);
        const cleanReply = replyText.replace(/OPEN_NODE:.+/, "").trim() || `Opening ${nodeId}...`;
        setMessages(prev => [...prev, { role: "assistant", text: cleanReply }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: replyText }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. Check your network." }]);
    }
    setChatLoading(false);
  }, [input, messages, chatLoading, nodesConfig, summaryMap, selectedNode, currentSummary, onNodeSelect]);

  /* ── render ── */
  return (
    <div className="fa-root">
      {/* Expanded panel */}
      {open && (
        <div className="fa-panel">
          {/* Panel header */}
          <div className="fa-panel-header">
            <div className="fa-tabs">
              <button
                className={`fa-tab ${tab === "chat"  ? "fa-tab--active" : ""}`}
                onClick={() => setTab("chat")}
              >🤖 AI Chat</button>
              <button
                className={`fa-tab ${tab === "voice" ? "fa-tab--active" : ""}`}
                onClick={() => setTab("voice")}
              >🎤 Voice</button>
            </div>
            <button className="fa-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* ── CHAT TAB ── */}
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
                    <div className="fa-msg-bubble fa-typing">
                      <span /><span /><span />
                    </div>
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
                <button className="fa-send-btn" onClick={sendChat} disabled={chatLoading}>
                  ➤
                </button>
              </div>
            </div>
          )}

          {/* ── VOICE TAB ── */}
          {tab === "voice" && (
            <div className="fa-voice">
              {!sttSupported ? (
                <div className="fa-unsupported">
                  ⚠️ Voice not supported. Use Chrome or Edge.
                </div>
              ) : (
                <>
                  <button
                    className={`fa-mic-big ${listening ? "fa-mic-big--active" : ""}`}
                    onClick={toggleMic}
                  >
                    <span className="fa-mic-icon">{listening ? "⏹" : "🎤"}</span>
                    <span className="fa-mic-label">{listening ? "Listening… tap to stop" : "Tap to speak"}</span>
                    {listening && <span className="fa-pulse" />}
                  </button>

                  {transcript && (
                    <div className="fa-voice-row">
                      <div className="fa-voice-label">You said</div>
                      <div className="fa-voice-text">{transcript}</div>
                    </div>
                  )}
                  {voiceReply && (
                    <div className="fa-voice-row">
                      <div className="fa-voice-label">Assistant</div>
                      <div className="fa-voice-text fa-voice-reply">{voiceReply}</div>
                    </div>
                  )}

                  <div className="fa-hints">
                    <strong>Try:</strong> "open SAP delivery" · "show WMS replication"
                    · "how many failed" · "list nodes"
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* FAB button */}
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