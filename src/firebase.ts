// Firebase 초기 설정 파일
// 실제 값은 Firebase 콘솔에서 발급받은 값을 .env 파일로 분리해서 사용하는 것을 추천합니다.

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

export async function saveMessageToFirestore(payload: {
  role: 'user' | 'assistant'
  content: string
}) {
  try {
    const ref = collection(db, 'sejong-chat')
    await addDoc(ref, {
      role: payload.role,
      content: payload.content,
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('Failed to save message to Firestore', e)
  }
}


