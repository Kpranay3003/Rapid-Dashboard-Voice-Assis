/**
 * FloatingAssistant.jsx
 * 100% local chatbot — no API key, no external service.
 * Reads live data from your backend (/api/summary, /api/node).
 *
 * Supported queries:
 *  - Total / success / failed for any node
 *  - List all nodes
 *  - Open / navigate to a node
 *  - Compare two nodes
 *  - Which node has most failures
 *  - Overall summary (all nodes combined)
 *  - Help / greet
 */
import { useState, useEffect, useRef, useCallback } from "react";
import "./FloatingAssistant.css";
import { getSummary } from "../services/api";

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/* Match a spoken/typed phrase to a node */
function matchNode(text, nodes) {
  const t = norm(text);
  // exact id
  for (const n of nodes) if (t.includes(norm(n.id))) return n;
  // label word overlap
  let best = null, bestScore = 0;
  for (const n of nodes) {
    const words   = norm(n.label.replace(/\n/g, " ")).split(" ").filter(w => w.length > 2);
    const hits    = words.filter(w => t.includes(w));
    const score   = words.length ? hits.length / words.length : 0;
    if (score > bestScore && score >= 0.25) { bestScore = score; best = n; }
  }
  return best;
}

/* Friendly label */
const label = (n) => n.label.replace(/\n/g, " ");

/* ═══════════════════════════════════════════════
   LOCAL CHATBOT BRAIN
   Returns a response object:
     { text, nodeToOpen? }
═══════════════════════════════════════════════ */
async function getBotResponse(userText, nodes, currentNode, currentSummary) {
  const t = norm(userText);

  /* ── greet ── */
  if (/^(hi|hello|hey|good\s*(morning|evening|afternoon)|howdy)/.test(t)) {
    return { text: "👋 Hello! I'm your Rapid Dashboard assistant. I can tell you success, failed, and total counts for any node, compare nodes, or navigate for you. Just ask!" };
  }

  /* ── help ── */
  if (t.includes("help") || t.includes("what can you") || t.includes("commands")) {
    return { text: `Here's what I can do:\n\n• **Show stats** — "how many failed in WMS replication?"\n• **Total count** — "total for SAP delivery"\n• **List nodes** — "list all nodes"\n• **Open a node** — "open cop hop"\n• **Compare** — "compare WMS replication and SAP delivery"\n• **Worst node** — "which node has most failures?"\n• **All nodes summary** — "show overall summary"\n• **Current node** — "status of current node"` };
  }

  /* ── list nodes ── */
  if (t.includes("list") || t.includes("all node") || t.includes("available node") || t.includes("what node")) {
    const list = nodes.map((n, i) => `${i + 1}. ${label(n)}`).join("\n");
    return { text: `📋 There are ${nodes.length} nodes:\n\n${list}` };
  }

  /* ── overall / all nodes summary ── */
  if ((t.includes("overall") || t.includes("all node") || t.includes("everything") || t.includes("total overall")) && (t.includes("summary") || t.includes("total") || t.includes("status") || t.includes("overview"))) {
    try {
      const results = await Promise.all(nodes.map(n => getSummary(n.id).then(s => ({ n, s })).catch(() => ({ n, s: { total: 0, success: 0, failed: 0 } }))));
      let totalAll = 0, successAll = 0, failedAll = 0;
      const lines = results.map(({ n, s }) => {
        totalAll   += s.total   || 0;
        successAll += s.success || 0;
        failedAll  += s.failed  || 0;
        return `• ${label(n)}: ${(s.total||0).toLocaleString()} total, ${(s.success||0).toLocaleString()} ✅, ${(s.failed||0).toLocaleString()} ❌`;
      });
      return { text: `📊 **Overall Summary** (all nodes)\n\n${lines.join("\n")}\n\n**Grand Total: ${totalAll.toLocaleString()} | ✅ ${successAll.toLocaleString()} | ❌ ${failedAll.toLocaleString()}**` };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── which node has most failures ── */
  if ((t.includes("most fail") || t.includes("highest fail") || t.includes("worst node") || t.includes("most error"))) {
    try {
      const results = await Promise.all(nodes.map(n => getSummary(n.id).then(s => ({ n, s })).catch(() => ({ n, s: { failed: 0 } }))));
      const worst = results.reduce((a, b) => (b.s.failed || 0) > (a.s.failed || 0) ? b : a);
      return { text: `🔴 **${label(worst.n)}** has the most failures with **${(worst.s.failed || 0).toLocaleString()} failed** transactions out of ${(worst.s.total || 0).toLocaleString()} total.` };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── which node has most success ── */
  if (t.includes("most success") || t.includes("best node") || t.includes("highest success")) {
    try {
      const results = await Promise.all(nodes.map(n => getSummary(n.id).then(s => ({ n, s })).catch(() => ({ n, s: { success: 0 } }))));
      const best = results.reduce((a, b) => (b.s.success || 0) > (a.s.success || 0) ? b : a);
      return { text: `🟢 **${label(best.n)}** has the most successes with **${(best.s.success || 0).toLocaleString()} successful** transactions out of ${(best.s.total || 0).toLocaleString()} total.` };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── compare two nodes ── */
  if (t.includes("compare") || t.includes("vs") || t.includes("versus") || t.includes("difference between")) {
    const matched = nodes.filter(n => {
      const words = norm(label(n)).split(" ").filter(w => w.length > 2);
      return words.some(w => t.includes(w));
    });
    if (matched.length >= 2) {
      try {
        const [a, b]    = matched;
        const [sa, sb]  = await Promise.all([getSummary(a.id), getSummary(b.id)]);
        const failDiff  = Math.abs((sa.failed || 0) - (sb.failed || 0));
        const winner    = (sa.failed || 0) < (sb.failed || 0) ? label(a) : label(b);
        return { text: `📊 **Comparison**\n\n**${label(a)}**\n  Total: ${(sa.total||0).toLocaleString()} | ✅ ${(sa.success||0).toLocaleString()} | ❌ ${(sa.failed||0).toLocaleString()}\n\n**${label(b)}**\n  Total: ${(sb.total||0).toLocaleString()} | ✅ ${(sb.success||0).toLocaleString()} | ❌ ${(sb.failed||0).toLocaleString()}\n\n💡 **${winner}** has fewer failures by ${failDiff.toLocaleString()}.` };
      } catch {
        return { text: "❌ Could not fetch data. Is the backend running?" };
      }
    }
    return { text: "Please mention two node names to compare. Example: \"compare WMS replication and SAP delivery\"" };
  }

  /* ── current node status ── */
  if ((t.includes("current") || t.includes("this node") || t.includes("selected")) && (t.includes("status") || t.includes("summary") || t.includes("total") || t.includes("fail") || t.includes("success"))) {
    if (!currentNode) return { text: "No node is currently selected. Click a node on the diagram or say \"open [node name]\"." };
    try {
      const s = await getSummary(currentNode);
      const pct = s.total ? Math.round((s.failed / s.total) * 100) : 0;
      return { text: `📍 **${currentNode}** (currently selected)\n\n• Total: ${(s.total||0).toLocaleString()}\n• ✅ Success: ${(s.success||0).toLocaleString()}\n• ❌ Failed: ${(s.failed||0).toLocaleString()}\n• Failure rate: ${pct}%` };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── open / navigate to a node ── */
  if (t.includes("open") || t.includes("show") || t.includes("navigate") || t.includes("go to") || t.includes("take me")) {
    const n = matchNode(userText, nodes);
    if (n) {
      try {
        const s   = await getSummary(n.id);
        const pct = s.total ? Math.round((s.failed / s.total) * 100) : 0;
        return { text: `🔀 Opening **${label(n)}**\n\n• Total: ${(s.total||0).toLocaleString()}\n• ✅ Success: ${(s.success||0).toLocaleString()}\n• ❌ Failed: ${(s.failed||0).toLocaleString()}\n• Failure rate: ${pct}%`, nodeToOpen: n.id };
      } catch {
        return { text: `Opening **${label(n)}**…`, nodeToOpen: n.id };
      }
    }
    return { text: "I couldn't find that node. Try \"list nodes\" to see all available nodes." };
  }

  /* ── failed / errors ── */
  if (t.includes("fail") || t.includes("error") || t.includes("issue")) {
    const n = matchNode(userText, nodes);
    if (n) {
      try {
        const s   = await getSummary(n.id);
        const pct = s.total ? Math.round((s.failed / s.total) * 100) : 0;
        return { text: `❌ **${label(n)}** has **${(s.failed||0).toLocaleString()} failed** transactions.\n\nOut of ${(s.total||0).toLocaleString()} total — that's a ${pct}% failure rate.` };
      } catch {
        return { text: "❌ Could not fetch data. Is the backend running?" };
      }
    }
    // No specific node — show all failed counts
    try {
      const results = await Promise.all(nodes.map(n => getSummary(n.id).then(s => ({ n, s })).catch(() => ({ n, s: { failed: 0, total: 0 } }))));
      const lines = results.map(({ n, s }) => {
        const pct = s.total ? Math.round(((s.failed||0) / s.total) * 100) : 0;
        return `• ${label(n)}: ❌ ${(s.failed||0).toLocaleString()} (${pct}%)`;
      });
      return { text: `❌ **Failed counts across all nodes:**\n\n${lines.join("\n")}` };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── success ── */
  if (t.includes("success") || t.includes("passed") || t.includes("completed")) {
    const n = matchNode(userText, nodes);
    if (n) {
      try {
        const s   = await getSummary(n.id);
        const pct = s.total ? Math.round((s.success / s.total) * 100) : 0;
        return { text: `✅ **${label(n)}** has **${(s.success||0).toLocaleString()} successful** transactions.\n\nOut of ${(s.total||0).toLocaleString()} total — that's a ${pct}% success rate.` };
      } catch {
        return { text: "❌ Could not fetch data. Is the backend running?" };
      }
    }
    try {
      const results = await Promise.all(nodes.map(n => getSummary(n.id).then(s => ({ n, s })).catch(() => ({ n, s: { success: 0, total: 0 } }))));
      const lines = results.map(({ n, s }) => {
        const pct = s.total ? Math.round(((s.success||0) / s.total) * 100) : 0;
        return `• ${label(n)}: ✅ ${(s.success||0).toLocaleString()} (${pct}%)`;
      });
      return { text: `✅ **Success counts across all nodes:**\n\n${lines.join("\n")}` };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── total / count ── */
  if (t.includes("total") || t.includes("count") || t.includes("how many") || t.includes("number of")) {
    const n = matchNode(userText, nodes);
    if (n) {
      try {
        const s = await getSummary(n.id);
        return { text: `📊 **${label(n)}** has a total of **${(s.total||0).toLocaleString()} transactions**.\n\n• ✅ Success: ${(s.success||0).toLocaleString()}\n• ❌ Failed: ${(s.failed||0).toLocaleString()}` };
      } catch {
        return { text: "❌ Could not fetch data. Is the backend running?" };
      }
    }
  }

  /* ── status / summary for a named node (catch-all) ── */
  const n = matchNode(userText, nodes);
  if (n) {
    try {
      const s   = await getSummary(n.id);
      const pct = s.total ? Math.round(((s.failed||0) / s.total) * 100) : 0;
      return {
        text: `📊 **${label(n)}**\n\n• Total: ${(s.total||0).toLocaleString()}\n• ✅ Success: ${(s.success||0).toLocaleString()}\n• ❌ Failed: ${(s.failed||0).toLocaleString()}\n• Failure rate: ${pct}%`,
        nodeToOpen: n.id,
      };
    } catch {
      return { text: "❌ Could not fetch data. Is the backend running?" };
    }
  }

  /* ── thank you ── */
  if (t.includes("thank") || t.includes("thanks") || t.includes("great") || t.includes("nice")) {
    return { text: "😊 You're welcome! Let me know if you need anything else." };
  }

  /* ── bye ── */
  if (t.includes("bye") || t.includes("goodbye") || t.includes("see you")) {
    return { text: "👋 Goodbye! Come back anytime." };
  }

  /* ── fallback ── */
  return { text: `I'm not sure about that. Here are some things you can ask:\n\n• "failed in WMS replication"\n• "total for SAP delivery"\n• "compare cop hop and och hop"\n• "which node has most failures"\n• "list nodes"\n• "overall summary"\n\nType **help** for the full list.` };
}

/* ═══════════════════════════════════════════════
   RENDER CHAT TEXT  (supports **bold** and \n)
═══════════════════════════════════════════════ */
function RenderText({ text }) {
  return (
    <span>
      {text.split("\n").map((line, i) => {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <span key={i}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            {i < text.split("\n").length - 1 && <br />}
          </span>
        );
      })}
    </span>
  );
}

/* ═══════════════════════════════════════════════
   STT HELPERS
═══════════════════════════════════════════════ */
const norm2 = (s = "") => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

function matchNodeVoice(transcript, nodes) {
  const t = norm2(transcript);
  for (const n of nodes) if (t.includes(norm2(n.id))) return n.id;
  let best = null, bestScore = 0;
  for (const n of nodes) {
    const words = norm2(n.label.replace(/\n/g, " ")).split(" ").filter(w => w.length > 2);
    const hits  = words.filter(w => t.includes(w));
    const score = words.length ? hits.length / words.length : 0;
    if (score > bestScore && score >= 0.3) { bestScore = score; best = n.id; }
  }
  return best;
}

/* ═══════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════ */
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
  const [messages,    setMessages]    = useState([
    { role: "assistant", text: "👋 Hi! I'm your dashboard assistant.\n\nAsk me things like:\n• \"failed in WMS replication\"\n• \"compare SAP delivery and cop hop\"\n• \"overall summary\"\n• \"which node has most failures\"\n\nType **help** for all commands." }
  ]);
  const [input,       setInput]       = useState("");
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ── speak ── */
  const speak = useCallback((text) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    const plain = text.replace(/\*\*/g, "").replace(/[📊✅❌📋📍🔀🟢🔴😊👋]/g, "");
    const utt   = new SpeechSynthesisUtterance(plain);
    utt.rate = 1; utt.pitch = 1; utt.volume = 1;
    const voices = synth.getVoices();
    const v = voices.find(v => v.name.includes("Google") || v.lang === "en-US");
    if (v) utt.voice = v;
    synth.speak(utt);
    setVoiceReply(plain.slice(0, 180));
  }, []);

  /* ── voice command ── */
  const handleVoiceCommand = useCallback(async (text) => {
    const t = norm2(text);
    if (t.includes("stop") || t.includes("close")) { speak("Stopped."); return; }
    if (t.includes("list") || t.includes("available")) {
      speak("Available nodes: " + nodesConfig.map(n => n.label.replace(/\n/g, " ")).join(", "));
      return;
    }
    if (t.includes("how many") || t.includes("summary") || t.includes("overall")) {
      if (!selectedNode) { speak("Please open a node first."); return; }
      setVoiceLoading(true);
      try {
        const s = await getSummary(selectedNode);
        const lbl = nodesConfig.find(n => n.id === selectedNode)?.label.replace(/\n/g, " ") || selectedNode;
        speak(`${lbl}: total ${s.total ?? 0}, success ${s.success ?? 0}, failed ${s.failed ?? 0}.`);
      } catch { speak("Could not fetch data."); }
      setVoiceLoading(false);
      return;
    }
    const nodeId = matchNodeVoice(text, nodesConfig);
    if (nodeId) {
      const lbl = nodesConfig.find(n => n.id === nodeId)?.label.replace(/\n/g, " ") || nodeId;
      setVoiceLoading(true);
      try {
        const s = await getSummary(nodeId);
        speak(`Opening ${lbl}. Total: ${(s.total??0).toLocaleString()}, Success: ${(s.success??0).toLocaleString()}, Failed: ${(s.failed??0).toLocaleString()}.`);
        onNodeSelect(nodeId);
      } catch { speak(`Opening ${lbl}.`); onNodeSelect(nodeId); }
      setVoiceLoading(false);
    } else {
      speak(`No match for "${text}". Try saying a node name.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesConfig, selectedNode, onNodeSelect, speak]);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) { rec.stop(); setListening(false); }
    else {
      setTranscript(""); setVoiceReply("");
      try { rec.start(); setListening(true); } catch (e) { console.error(e); }
    }
  };

  /* ── send chat (fully local) ── */
  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setChatLoading(true);
    const response = await getBotResponse(text, nodesConfig, selectedNode, currentSummary);
    setMessages(prev => [...prev, { role: "assistant", text: response.text }]);
    if (response.nodeToOpen) onNodeSelect(response.nodeToOpen);
    setChatLoading(false);
  }, [input, chatLoading, nodesConfig, selectedNode, currentSummary, onNodeSelect]);

  /* ── render ── */
  return (
    <div className="fa-root">
      {open && (
        <div className="fa-panel">
          <div className="fa-panel-header">
            <div className="fa-tabs">
              <button className={`fa-tab ${tab === "chat"  ? "fa-tab--active" : ""}`} onClick={() => setTab("chat")}>🤖 Chat</button>
              <button className={`fa-tab ${tab === "voice" ? "fa-tab--active" : ""}`} onClick={() => setTab("voice")}>🎤 Voice</button>
            </div>
            <button className="fa-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* CHAT */}
          {tab === "chat" && (
            <div className="fa-chat">
              <div className="fa-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`fa-msg fa-msg--${m.role}`}>
                    {m.role === "assistant" && <span className="fa-msg-avatar">🤖</span>}
                    <div className="fa-msg-bubble"><RenderText text={m.text} /></div>
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
                  disabled={chatLoading}
                />
                <button className="fa-send-btn" onClick={sendChat} disabled={chatLoading}>➤</button>
              </div>
            </div>
          )}

          {/* VOICE */}
          {tab === "voice" && (
            <div className="fa-voice">
              {!sttSupported ? (
                <div className="fa-unsupported">⚠️ Use Chrome or Edge for voice.</div>
              ) : (
                <>
                  <button
                    className={`fa-mic-big ${listening ? "fa-mic-big--active" : ""} ${voiceLoading ? "fa-mic-big--loading" : ""}`}
                    onClick={toggleMic}
                    disabled={voiceLoading}
                  >
                    <span className="fa-mic-icon">{voiceLoading ? "⏳" : listening ? "⏹" : "🎤"}</span>
                    <span className="fa-mic-label">{voiceLoading ? "Fetching…" : listening ? "Listening… tap to stop" : "Tap to speak"}</span>
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
                    "how many failed in SAP delivery"<br />
                    "list nodes"
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

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
