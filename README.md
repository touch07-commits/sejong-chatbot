# 세종대왕 인터뷰 챗봇

React + Vite + TypeScript 기반의 간단한 인터뷰 챗봇입니다.  
Netlify Functions에서 OpenAI GPT API를 호출해 세종대왕 말투로 답변하고, Firebase Firestore에 대화를 저장합니다.

## 주요 기능
- 질문 입력 → Netlify Functions → GPT API → 세종대왕 스타일 답변
- 답변과 사용자 질문을 Firestore `sejong-chat` 컬렉션에 저장
- Netlify에 바로 배포할 수 있는 구성(`netlify.toml`, 서버리스 함수 포함)

## 환경 변수 설정
### 1. 로컬 개발
1. `.env.example`을 참고하여 프로젝트 루트에 `.env` 파일을 만듭니다.
2. 실제 값을 입력합니다.
   ```
   cp .env.example .env # 작성 후 값 채우기
   ```
3. Vite는 `VITE_` 접두어가 붙은 값만 프론트엔드에서 접근할 수 있습니다.
4. OpenAI 키는 `OPENAI_API_KEY` 혹은 `gptapikey` 둘 중 하나의 이름으로 넣으면 됩니다.

### 2. Netlify 배포 환경
Netlify 대시보드 → Site configuration → Environment variables → “Add variable”

| Key | Value 예시 | 비고 |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase 콘솔 값 | 필수 |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | 필수 |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` | 필수 |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` | 필수 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase 값 | 필수 |
| `VITE_FIREBASE_APP_ID` | Firebase 값 | 필수 |
| `OPENAI_API_KEY` 또는 `gptapikey` | 새로 발급한 OpenAI 키 | 둘 중 하나만 있어도 인식 |

환경 변수를 저장한 뒤 `Deploys` 탭에서 **Trigger deploy → Clear cache and deploy**를 실행하면 됩니다.

## 개발 방법
```bash
npm install          # 의존성 설치
npm run dev          # Vite 개발 서버 (프론트만)
npm run netlify:dev  # Netlify Functions까지 포함한 로컬 개발
npm run build        # 타입체크 + 프로덕션 빌드
```

## 배포 순서 요약
1. 이 저장소를 GitHub에 올린 뒤 Netlify에서 “New site from Git” 선택
2. Build command: `npm run build`, Publish directory: `dist`
3. Environment variables 설정 후 Deploy

## 추가 개선 아이디어
- Firestore에서 기존 대화 불러오기
- 인터뷰 세션 구분, 즐겨찾기, 요약 등
- 프롬프트 튜닝으로 더 다양한 답변 컨트롤

이 저장소를 그대로 Netlify에 연결하면 간단히 “세종대왕 인터뷰 챗봇”을 체험할 수 있습니다.
