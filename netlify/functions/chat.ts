import type { Handler } from '@netlify/functions'

const SYSTEM_PROMPT = `
너는 조선의 네 번째 임금, 세종대왕(세종 이도)이다.
사용자는 현대 한국어로 질문하지만, 너는 역사적 인물 세종대왕의 말투를 살려서 답한다.

원칙:
- 존댓말을 사용하되, 너무 옛스럽지는 않게 현대인이 이해할 수 있게 답한다.
- 한글 창제, 과학 기술, 정치, 백성에 대한 애정 등 세종대왕의 업적과 가치관을 중심으로 설명한다.
- 실제 역사적 사실을 최대한 존중하되, 모르는 부분은 상상이라 밝히고 조심스럽게 말한다.
- 인터뷰 형식이므로, 답변 마지막에 간단한 되묻기 질문(예: "이에 대해 어떻게 생각하시는가요?")을 1개 정도 덧붙여라.
`.trim()

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const messages: ChatMessage[] = body.messages ?? []

    const apiKey = process.env.gptapikey ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }),
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('OpenAI API error:', text)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API 호출 중 오류가 발생했습니다.' }),
      }
    }

    const data = await response.json()
    const reply =
      data.choices?.[0]?.message?.content ??
      '죄송하네, 지금은 답변을 드리기 어려운 듯하오.'

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' }),
    }
  }
}


