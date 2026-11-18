"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Mode = "spark" | "focus" | "scholar";
type SavedSpark = { id: string; text: string; savedAt: string };

const prompts: Record<Mode, string[]> = {
  spark: ["Help me dream up a weekend project", "Turn a small idea into something big", "Give this day a plot twist"],
  focus: ["Help me plan a calm, productive day", "Break my big task into tiny steps", "Help me get unstuck on one thing"],
  scholar: ["Explain a big idea in a simple way", "Help me learn something fascinating", "Compare two ideas I keep mixing up"],
};

const modeDetails: Record<Mode, { label: string; eyebrow: string; title: string; description: string }> = {
  spark: { label: "Spark", eyebrow: "YOUR CREATIVE SIDEKICK", title: "Let's make something\nunexpected.", description: "Bring a half-formed thought. Leave with a little momentum." },
  focus: { label: "Focus", eyebrow: "YOUR CALM CO-PILOT", title: "One clear step\nchanges everything.", description: "Untangle the to-do list and find your next small win." },
  scholar: { label: "Scholar", eyebrow: "YOUR CURIOUS COMPANION", title: "Follow the question.\nFind the wonder.", description: "Explore new ideas with an open mind and a clear map." },
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const shapes: Record<string, React.ReactNode> = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8M8 14h5" /></>,
    bookmark: <><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z" /></>,
    spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    send: <><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4 18-7Z" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    bolt: <><path d="m13 2-3 8H5l6 12 3-9h5L13 2Z" /></>,
  };
  return <svg {...common}>{shapes[name] ?? shapes.spark}</svg>;
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("spark");
  const modeRef = useRef(mode);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState<SavedSpark[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("jervious-sparks") ?? "[]") as SavedSpark[]); } catch { setSaved([]); }
    setSavedLoaded(true);
  }, []);
  useEffect(() => { if (savedLoaded) localStorage.setItem("jervious-sparks", JSON.stringify(saved)); }, [saved, savedLoaded]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ mode: modeRef.current }),
  }), []);
  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const activeMode = modeDetails[mode];

  useEffect(() => {
    function onShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMessages([]);
        setShowSaved(false);
        setInput("");
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [setMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  function startFresh() {
    setMessages([]);
    setShowSaved(false);
    setInput("");
    inputRef.current?.focus();
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setShowSaved(false);
    await sendMessage({ text });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  function textFor(message: (typeof messages)[number]) {
    return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard");
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setNotice("Clipboard access is unavailable here");
      window.setTimeout(() => setNotice(""), 2200);
    }
  }

  function saveText(text: string) {
    if (!saved.some((item) => item.text === text)) {
      setSaved((items) => [{ id: crypto.randomUUID(), text, savedAt: new Date().toISOString() }, ...items]);
      setNotice("Saved to your sparks");
    } else {
      setNotice("Already saved");
    }
    window.setTimeout(() => setNotice(""), 1800);
  }

  function surpriseMe() {
    const choices = prompts[mode];
    setInput(choices[Math.floor(Math.random() * choices.length)]);
    inputRef.current?.focus();
  }

  return (
    <main className={`app-shell ${mobileOpen ? "menu-open" : ""}`}>
      {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <a className="brand" href="#top" onClick={startFresh} aria-label="Jervious home">
          <BrandMark />
          <span>jervious</span>
          <span className="brand-dot">✳</span>
        </a>
        <button className="new-chat" onClick={() => { startFresh(); setMobileOpen(false); }}><Icon name="plus" size={17} /> New conversation <span>⌘ K</span></button>
        <div className="side-label">YOUR SPACE</div>
        <button className={`side-link ${!showSaved ? "selected" : ""}`} onClick={() => { setShowSaved(false); setMobileOpen(false); inputRef.current?.focus(); }}><Icon name="chat" size={17} /> <span>Chat with Jervious</span></button>
        <button className={`side-link ${showSaved ? "selected" : ""}`} onClick={() => { setShowSaved(true); setMobileOpen(false); }}><Icon name="bookmark" size={17} /> <span>Saved sparks</span><span className="count-pill">{saved.length}</span></button>
        <div className="side-rule" />
        <div className="side-label">A LITTLE INSPIRATION</div>
        <div className="sidebar-note"><div className="note-star"><Icon name="spark" size={16} /></div><p>Small ideas have a way of becoming big things.</p><span>YOUR DAILY REMINDER</span></div>
        <div className="sidebar-bottom">
          <div className="profile-avatar">J</div>
          <div className="profile-copy"><strong>Your space</strong><span>Made for curious minds</span></div>
          <span className="online-dot" title="Jervious is ready" />
        </div>
      </aside>

      <section className="main-panel" id="top">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><Icon name={mobileOpen ? "close" : "menu"} /></button>
          <div className="breadcrumb"><span>Your space</span><span className="crumb-slash">/</span><strong>{showSaved ? "Saved sparks" : "New conversation"}</strong></div>
          <div className="topbar-right"><span className="claude-status"><i /> Powered by Claude</span><span className="topbar-separator" /><button className="avatar-small" title="Jervious">J</button></div>
        </header>

        <div className={`content-area ${messages.length > 0 || showSaved ? "has-messages" : ""}`} ref={scrollRef}>
          {showSaved ? (
            <section className="saved-view">
              <div className="page-kicker"><Icon name="bookmark" size={14} /> YOUR LITTLE IDEA LIBRARY</div>
              <h1>Your saved sparks<span className="title-star">✳</span></h1>
              <p className="saved-intro">Good thoughts deserve a place to land.</p>
              {saved.length ? <div className="saved-grid">{saved.map((item) => <article className="saved-card" key={item.id}><span className="saved-card-label">SAVED IDEA</span><p>{item.text}</p><div className="saved-card-footer"><span>{new Date(item.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><div><button onClick={() => copyText(item.text)} aria-label="Copy saved spark"><Icon name="copy" size={15} /></button><button onClick={() => setSaved((items) => items.filter((spark) => spark.id !== item.id))} aria-label="Remove saved spark"><Icon name="close" size={15} /></button></div></div></article>)}</div> : <div className="empty-saved"><div className="empty-icon"><Icon name="spark" size={23} /></div><strong>Your idea jar is empty</strong><span>Save a helpful Jervious reply and it will be waiting here.</span><button onClick={() => { setShowSaved(false); inputRef.current?.focus(); }}>Start a conversation <Icon name="arrow" size={15} /></button></div>}
            </section>
          ) : messages.length === 0 ? (
            <section className="welcome">
              <div className="hero-copy">
                <div className="page-kicker"><span className="kicker-dot" /> {activeMode.eyebrow}</div>
                <h1>{activeMode.title.split("\n").map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}<span className="title-star">✳</span></h1>
                <p className="hero-description">{activeMode.description}</p>
                <div className="mode-switch" role="tablist" aria-label="Choose a Jervious personality">
                  {(["spark", "focus", "scholar"] as Mode[]).map((item) => <button key={item} role="tab" aria-selected={mode === item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item === "spark" ? <Icon name="spark" size={14} /> : item === "focus" ? <Icon name="bolt" size={14} /> : <span className="mode-emoji">✧</span>}{modeDetails[item].label}</button>)}
                </div>
              </div>
              <div className="orb-scene" aria-hidden="true">
                <div className="orb-glow" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
                <div className="orb"><div className="orb-shine" /><div className="orb-core" /><div className="orb-rim" /></div>
                <div className="orb-spark spark-one">✦</div><div className="orb-spark spark-two">✧</div><div className="orb-spark spark-three">·</div>
              </div>
              <div className="prompt-zone">
                <div className="prompt-heading"><span>TRY A LITTLE SOMETHING</span><span className="prompt-line" /></div>
                <div className="prompt-grid">{prompts[mode].map((prompt, index) => <button className="prompt-card" key={prompt} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}><span className={`prompt-index index-${index}`}>0{index + 1}</span><span>{prompt}</span><Icon name="arrow" size={16} /></button>)}</div>
              </div>
            </section>
          ) : (
            <section className="conversation" aria-live="polite">
              <div className="conversation-date"><span /> A FRESH LITTLE THOUGHT <span /></div>
              {messages.map((message) => {
                const text = textFor(message);
                if (!text) return null;
                return <article key={message.id} className={`message ${message.role === "user" ? "user-message" : "assistant-message"}`}>
                  {message.role === "assistant" && <div className="message-avatar"><BrandMark /></div>}
                  <div className="message-content"><div className="message-author">{message.role === "user" ? "You" : "Jervious"}<span>{message.role === "assistant" ? "· " + modeDetails[mode].label + " mode" : ""}</span></div><div className="message-bubble">{text}{message.role === "assistant" && busy && message.id === messages[messages.length - 1]?.id && <span className="typing-cursor" />}</div>
                    {message.role === "assistant" && <div className="message-actions"><button onClick={() => copyText(text)}><Icon name="copy" size={14} /> Copy</button><button onClick={() => saveText(text)}><Icon name="bookmark" size={14} /> Save spark</button></div>}
                  </div>
                </article>;
              })}
              {busy && !messages[messages.length - 1]?.parts.some((part) => part.type === "text" && part.text) && <div className="thinking-row"><div className="message-avatar"><BrandMark /></div><div><span className="thinking-label">Jervious is thinking</span><div className="thinking-dots"><i /><i /><i /></div></div></div>}
              {error && <div className="chat-error"><strong>That reply didn’t make it through.</strong><span>{error.message || "Check your connection and try again."}</span></div>}
            </section>
          )}
        </div>

        {!showSaved && <div className="composer-wrap">
          {messages.length === 0 && <div className="composer-tip"><span className="tip-spark">✳</span> The best chats start anywhere.</div>}
          <form className="composer" onSubmit={submit}>
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything, or follow a little curiosity…" rows={1} aria-label="Message Jervious" />
            <div className="composer-bottom"><div className="composer-tools"><button type="button" className="surprise-button" onClick={surpriseMe}><Icon name="spark" size={15} /><span>Surprise me</span></button><span className="composer-hint">Shift + Enter for a new line</span></div><button className="send-button" type="submit" disabled={!input.trim() || busy} aria-label="Send message"><Icon name="send" size={17} /></button></div>
          </form>
          <div className="composer-disclaimer">Jervious can make mistakes. Let curiosity lead, then double-check what matters.</div>
        </div>}
      </section>
      {notice && <div className="toast"><Icon name="check" size={15} /> {notice}</div>}
    </main>
  );
}

