import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

// 타입 정의
export type Student = {
  uid: string
  name: string
  email: string
  photoURL?: string
}

export type Letter = {
  id: string
  content: string
  reply?: string
  createdAt: string
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type ChatSession = {
  id: string
  messages: Message[]
  createdAt: string
}

export type LearnResult = {
  id: string
  completedAt: string
  items: string[]
}

export type TypingResult = {
  id: string
  date: string
  score: number
  correct: number
  wrong: number
  level: number
  mode: 'classic' | 'falling' | 'archery'
}

export type DecoratedLetter = {
  id: string
  letter: string
  dataUrl: string
  createdAt: string
}

// 학생 목록 관리
export const saveStudent = async (student: Student) => {
  try {
    await setDoc(doc(db, 'students', student.uid), {
      ...student,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Failed to save student:', error)
    throw error
  }
}

export const getAllStudents = async (): Promise<Student[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'students'))
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    } as Student))
  } catch (error) {
    console.error('Failed to get students:', error)
    return []
  }
}

// 사용자 역할 관리
export const saveUserRole = async (uid: string, role: 'student' | 'teacher') => {
  try {
    await setDoc(doc(db, 'users', uid), {
      role,
      updatedAt: Timestamp.now()
    }, { merge: true })
  } catch (error) {
    console.error('Failed to save user role:', error)
    throw error
  }
}

export const getUserRole = async (uid: string): Promise<'student' | 'teacher' | null> => {
  try {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return docSnap.data().role || null
    }
    return null
  } catch (error) {
    console.error('Failed to get user role:', error)
    return null
  }
}

// 편지 관리
export const saveLetter = async (uid: string, letter: Letter) => {
  try {
    await addDoc(collection(db, 'users', uid, 'letters'), {
      ...letter,
      createdAt: Timestamp.fromDate(new Date(letter.createdAt))
    })
  } catch (error) {
    console.error('Failed to save letter:', error)
    throw error
  }
}

export const getLetters = async (uid: string): Promise<Letter[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'letters'))
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
    } as Letter))
  } catch (error) {
    console.error('Failed to get letters:', error)
    return []
  }
}

// 채팅 세션 관리
// 한 번 만든 세션 문서를 계속 업데이트해서 사용하기 위한 API
export const createChatSession = async (uid: string, session: ChatSession): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users', uid, 'chats'), {
      ...session,
      createdAt: Timestamp.fromDate(new Date(session.createdAt)),
      updatedAt: Timestamp.now(),
      messages: session.messages.map(msg => ({
        ...msg,
        createdAt: Timestamp.fromDate(new Date(msg.createdAt))
      }))
    })
    return docRef.id
  } catch (error) {
    console.error('Failed to create chat session:', error)
    throw error
  }
}

export const updateChatSession = async (uid: string, sessionId: string, messages: Message[]) => {
  try {
    const docRef = doc(db, 'users', uid, 'chats', sessionId)
    await updateDoc(docRef, {
      updatedAt: Timestamp.now(),
      messages: messages.map(msg => ({
        ...msg,
        createdAt: Timestamp.fromDate(new Date(msg.createdAt))
      }))
    })
  } catch (error) {
    console.error('Failed to update chat session:', error)
    throw error
  }
}

export const getChatSessions = async (uid: string): Promise<ChatSession[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'chats'))
    const sessions = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        messages: data.messages?.map((msg: any) => ({
          ...msg,
          createdAt: msg.createdAt?.toDate?.().toISOString() || new Date().toISOString()
        })) || [],
        createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString()
      } as ChatSession
    })
    // 시간순으로 정렬 (오래된 것부터)
    return sessions.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  } catch (error) {
    console.error('Failed to get chat sessions:', error)
    return []
  }
}

// 학습 결과 관리
export const saveLearnResult = async (uid: string, result: LearnResult) => {
  try {
    await addDoc(collection(db, 'users', uid, 'learnResults'), {
      ...result,
      completedAt: Timestamp.fromDate(new Date(result.completedAt))
    })
  } catch (error) {
    console.error('Failed to save learn result:', error)
    throw error
  }
}

export const getLearnResults = async (uid: string): Promise<LearnResult[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'learnResults'))
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      completedAt: doc.data().completedAt?.toDate?.().toISOString() || new Date().toISOString()
    } as LearnResult))
  } catch (error) {
    console.error('Failed to get learn results:', error)
    return []
  }
}

// 타자 연습 결과 관리
export const saveTypingResult = async (uid: string, result: TypingResult) => {
  try {
    await addDoc(collection(db, 'users', uid, 'typingResults'), {
      ...result,
      date: Timestamp.fromDate(new Date(result.date))
    })
  } catch (error) {
    console.error('Failed to save typing result:', error)
    throw error
  }
}

export const getTypingResults = async (uid: string): Promise<TypingResult[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'typingResults'))
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate?.().toISOString() || new Date().toISOString()
    } as TypingResult))
  } catch (error) {
    console.error('Failed to get typing results:', error)
    return []
  }
}

// 꾸민 글자 관리
export const saveDecoratedLetter = async (uid: string, decorated: DecoratedLetter) => {
  try {
    await addDoc(collection(db, 'users', uid, 'decoratedLetters'), {
      ...decorated,
      createdAt: Timestamp.fromDate(new Date(decorated.createdAt))
    })
  } catch (error) {
    console.error('Failed to save decorated letter:', error)
    throw error
  }
}

export const getDecoratedLetters = async (uid: string): Promise<DecoratedLetter[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'decoratedLetters'))
    return snapshot.docs
      .filter(doc => !doc.data().deleted) // 삭제된 항목 제외
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString()
      } as DecoratedLetter))
  } catch (error) {
    console.error('Failed to get decorated letters:', error)
    return []
  }
}

export const deleteDecoratedLetter = async (uid: string, letterId: string) => {
  try {
    const docRef = doc(db, 'users', uid, 'decoratedLetters', letterId)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Failed to delete decorated letter:', error)
    throw error
  }
}

// 간단한 테스트용 저장 함수
export const saveTestPing = async (uid: string) => {
  try {
    await addDoc(collection(db, 'testPings'), {
      uid,
      message: 'hello from sejong app',
      createdAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Failed to save test ping:', error)
    throw error
  }
}

