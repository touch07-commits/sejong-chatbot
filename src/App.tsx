import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import './App.css'
import { saveMessageToFirestore } from './firebase'

function App() {
  type Message = {
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // TODO: Firebase에서 대화 불러오기 (나중 단계에서 구현)
  useEffect(() => {
    // 초기 로딩 시 Firebase에서 최근 대화 가져오기 예정
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      })

      if (!res.ok) {
        throw new Error('서버 통신 중 오류가 발생했습니다.')
      }

      const data = await res.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? '죄송하네, 방금 답변을 가져오지 못했소.',
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Firebase에 대화 저장
      await Promise.all([
        saveMessageToFirestore({
          role: 'user',
          content: userMessage.content,
        }),
        saveMessageToFirestore({
          role: 'assistant',
          content: assistantMessage.content,
        }),
      ])
    } catch (err) {
      console.error(err)
      setError('답변을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-root">
      <div className="chat-container">
        <header className="chat-header">
          <h1>세종대왕 인터뷰 챗봇</h1>
          <p>궁금한 것을 무엇이든 물어보세요. 세종대왕께서 답해 주십니다.</p>
        </header>

        <main className="chat-main">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>첫 질문을 입력해 세종대왕과 인터뷰를 시작해 보세요.</p>
              <p className="chat-hint">
                예시: &quot;한글을 창제하게 된 이유가 무엇인가요?&quot;
              </p>
            </div>
          )}

          <ul className="message-list">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`message message-${m.role}`}
              >
                <div className="message-avatar">
                  {m.role === 'assistant' ? '세' : '나'}
                </div>
                <div className="message-bubble">
                  <div className="message-meta">
                    <span className="message-author">
                      {m.role === 'assistant' ? '세종대왕' : '나'}
                    </span>
                  </div>
                  <p className="message-content">{m.content}</p>
                </div>
              </li>
            ))}
          </ul>
        </main>

        <footer className="chat-footer">
          {error && <p className="error-text">{error}</p>}
          <form onSubmit={handleSubmit} className="chat-form">
            <input
              type="text"
              placeholder="세종대왕께 물어보고 싶은 내용을 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? '생각 중...' : '보내기'}
            </button>
          </form>
          <p className="chat-notice">
            * GPT API를 사용하며, 답변은 실제 역사와 다를 수 있습니다.
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
