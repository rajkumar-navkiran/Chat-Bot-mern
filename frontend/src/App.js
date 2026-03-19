import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || '';
const API_STREAM = `${API_BASE}/api/chat/stream`;

const MAX_MESSAGES = 50; // limit total messages (user + assistant); ~25 exchanges

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const atLimit = messages.length >= MAX_MESSAGES;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || atLimit) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(API_STREAM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.content) {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: last.content + data.content };
                  }
                  return next;
                });
              }
            } catch (e) {
              if (e.message) throw e;
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content || `Error: ${err.message}` };
        } else {
          next.push({ role: 'assistant', content: `Error: ${err.message}` });
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Clini Seva</h1>
        <p className="tagline">Clinic assistant — appointments, patients & clinic help</p>
        {messages.length > 0 && (
          <button type="button" className="clear-btn" onClick={clearChat}>
            Clear chat
          </button>
        )}
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            Ask about doctor appointments, adding patients, or clinic operations. I only help with clinic-related questions.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <span className="label">{msg.role === 'user' ? 'You' : 'Clini Seva'}</span>
            <div className="content">
              {msg.content || (msg.role === 'assistant' && loading ? '...' : '')}
            </div>
          </div>
        ))}
        {atLimit && !loading && (
          <div className="limit-msg">
            Conversation limit reached ({MAX_MESSAGES} messages). Use &quot;Clear chat&quot; to start again.
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-row">
        <textarea
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about appointments, patients, or clinic..."
          rows={1}
          disabled={loading || atLimit}
        />
        <button
          className="send"
          onClick={sendMessage}
          disabled={loading || !input.trim() || atLimit}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
