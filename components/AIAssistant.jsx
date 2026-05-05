'use client';

// components/AIAssistant.jsx — TeamBridge Japan AI Assistant Component
// Powered by Claude via /api/chat (server-side route)

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './AIAssistant.module.css';

const SUGGESTIONS = {
  en: [
    'Translate "The meeting is postponed to Friday" to Japanese',
    'Summarize our project status for the Japan team',
    'How do I say "please review this document" in Japanese?',
    'Draft a polite follow-up email in Japanese',
  ],
  ja: [
    '「会議は金曜日に延期します」を英語に翻訳してください',
    'プロジェクトの現状をドイツのチームに報告する文章を作成してください',
    '「このドキュメントを確認してください」をドイツ語で教えてください',
    '丁寧なフォローアップメールをドイツ語で作成してください',
  ],
};

const SYSTEM_PROMPT = `You are TeamBridge AI, a helpful assistant for a company with teams in Germany and Japan.

Your main capabilities:
- Translate between English, German (Deutsch), and Japanese (日本語)
- Help draft professional emails and messages
- Answer project and communication questions
- Summarize information for cross-cultural teams
- Explain cultural business etiquette for Japan and Germany

Always be concise, friendly, and professional. When translating, provide the translation clearly labeled.
If the user writes in Japanese, respond in Japanese. If in German, respond in German. Otherwise use English.`;

function TypingIndicator() {
  return (
    <div className={styles.typingBubble}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`${styles.messageRow} ${isUser ? styles.userRow : styles.assistantRow}`}>
      {!isUser && <div className={styles.aiAvatar}>AI</div>}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
        {msg.content}
      </div>
    </div>
  );
}

/**
 * @param {'en'|'ja'} lang
 */
export default function AIAssistant({ lang = 'en' }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: lang === 'ja'
        ? 'こんにちは！TeamBridge AIアシスタントです。英語・ドイツ語・日本語の翻訳、メールの作成、チームコミュニケーションをサポートします。何かお手伝いできますか？🤖'
        : "Hello! I'm the TeamBridge AI Assistant. I can help with EN/DE/JP translations, drafting messages, and cross-cultural communication. How can I help your team today? 🤖",
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    setInput('');
    setError(null);
    const updatedMessages = [...messages, { role: 'user', content: userText }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: updatedMessages,
          system:   SYSTEM_PROMPT,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setError(lang === 'ja' ? 'エラーが発生しました。もう一度お試しください。' : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, lang]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const suggestions = SUGGESTIONS[lang];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>✨</div>
          <span className={styles.headerTitle}>
            {lang === 'ja' ? 'AIアシスタント' : 'AI Assistant'}
          </span>
        </div>
        <span className={styles.headerSub}>EN · DE · 日本語</span>
      </div>

      <div className={styles.messageList}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div className={`${styles.messageRow} ${styles.assistantRow}`}>
            <div className={styles.aiAvatar}>AI</div>
            <TypingIndicator />
          </div>
        )}
        {error && <div className={styles.errorMsg}>{error}</div>}
        <div ref={endRef} />
      </div>

      {/* Suggestion chips — shown only when only the greeting exists */}
      {messages.length === 1 && (
        <div className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <button key={i} className={styles.chip} onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className={styles.inputBar}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={lang === 'ja' ? 'メッセージを入力... (Shift+Enterで改行)' : 'Ask anything… (Shift+Enter for new line)'}
          rows={1}
          disabled={loading}
        />
        <button
          className={styles.sendBtn}
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          {loading ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}
