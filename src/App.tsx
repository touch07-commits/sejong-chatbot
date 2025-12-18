import type { FormEvent } from 'react'
import { useEffect, useState, useRef } from 'react'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import {
  saveStudent,
  getAllStudents,
  saveLetter,
  getLetters,
  getChatSessions,
  getLearnResults,
  saveLearnResult,
  saveTypingResult,
  getTypingResults,
  saveDecoratedLetter,
  deleteDecoratedLetter,
  saveTestPing,
  createChatSession,
  updateChatSession,
  saveUserRole,
  getUserRole,
} from './firestore'
import './App.css'

type Mode = 'chat' | 'letter' | 'learn' | 'inbox' | 'decorate' | 'typing' | 'book' | 'word'

  type Message = {
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string
  }

type Letter = {
  id: string
  content: string
  reply?: string
  createdAt: string
}

type ChatSession = {
  id: string
  messages: Message[]
  createdAt: string
}

type LearnItem = {
  id: string
  icon: string
  name: string
  description: string
}

type LearnResult = {
  id: string
  completedAt: string
  items: string[]
}

type Student = {
  uid: string
  name: string
  email: string
  photoURL?: string
}

type UserRole = 'student' | 'teacher' | null

type TypingResult = {
  id: string
  date: string
  score: number
  correct: number
  wrong: number
  level: number
  mode: 'classic' | 'falling' | 'archery'
}

type StudentActivity = {
  letters: Letter[]
  learnResults: LearnResult[]
  chatSessions: ChatSession[]
  typingResults: TypingResult[]
}

function App() {
  const [mode, setMode] = useState<Mode>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [student, setStudent] = useState<Student | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentActivity, setStudentActivity] = useState<StudentActivity | null>(null)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [fetchingStudents, setFetchingStudents] = useState(false)
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null)
  const [selectedChatSession, setSelectedChatSession] = useState<ChatSession | null>(null)
  const [selectedLetterDetail, setSelectedLetterDetail] = useState<Letter | null>(null)
  
  // 편지 관련
  const [letterContent, setLetterContent] = useState('')
  const [savedLetters, setSavedLetters] = useState<Letter[]>([])
  const [sendingLetter, setSendingLetter] = useState(false)
  const [currentLetter, setCurrentLetter] = useState<Letter | null>(null)
  
  // 학습 관련
  const [allLearnItems, setAllLearnItems] = useState<LearnItem[]>([])
  const [_learnItems, setLearnItems] = useState<LearnItem[]>([])
  // @ts-ignore - setLearnResults에서 사용
  const [learnResults, setLearnResults] = useState<LearnResult[]>([])
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [_droppedItems, setDroppedItems] = useState<Record<string, { 
    name?: { text: string; sourceId: string }; 
    description?: { text: string; sourceId: string }; 
  }>>({})
  const [_draggedItem, _setDraggedItem] = useState<{ name: string; description: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [_shuffledDragItems, setShuffledDragItems] = useState<Array<{ id: string; type: 'name' | 'description'; text: string }>>([])
  // @ts-ignore - setIsDragging에서 사용
  const [_isDragging, _setIsDragging] = useState(false)
  const [_showSuccessMessage, _setShowSuccessMessage] = useState(false)
  const [_successMessage, _setSuccessMessage] = useState('')
  const [learnSaved, setLearnSaved] = useState(false)
  const [showLearnFeedback, setShowLearnFeedback] = useState(false)
  
  // 글자꾸미기 관련
  const [decoratedLetters, setDecoratedLetters] = useState<{ id: string; letter: string; dataUrl: string; createdAt: string }[]>([])
  const [selectedLetter, setSelectedLetter] = useState('')
  const [fillColor, setFillColor] = useState('#FFD700')
  const [strokeColor, setStrokeColor] = useState('#C93C3C')
  const [strokeWidth, setStrokeWidth] = useState(5)
  const [brushSize, setBrushSize] = useState(10)
  const [tool] = useState<'brush' | 'eraser'>('brush')
  const [isPainting, setIsPainting] = useState(false)
  const [fontFamily, setFontFamily] = useState<'Gungsuh' | 'Nanum Gothic' | 'Nanum Pen Script' | 'Jua'>('Gungsuh')
  const decorateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  // const letterPathRef = useRef<Path2D | null>(null)

  // 타자연습 관련
  const [typingMode, setTypingMode] = useState<'letter' | 'word'>('letter') // 한글자 또는 단어 모드
  const [gameStyle, setGameStyle] = useState<'classic' | 'falling' | 'archery'>('classic') // 게임 스타일
  const [currentTarget, setCurrentTarget] = useState('')
  const [typingInput, setTypingInput] = useState('')
  const [typingScore, setTypingScore] = useState(0)
  const [typingCorrect, setTypingCorrect] = useState(0)
  const [typingWrong, setTypingWrong] = useState(0)
  const [typingTime, setTypingTime] = useState(0)
  const [isTypingActive, setIsTypingActive] = useState(false)
  const [typingLevel, setTypingLevel] = useState(1)
  const [typingCombo, setTypingCombo] = useState(0) // 연속 정답
  const [typingMaxCombo, setTypingMaxCombo] = useState(0) // 최대 연속 정답
  const [typingFeedback, setTypingFeedback] = useState<string | null>(null)
  const [typingFeedbackType, setTypingFeedbackType] = useState<'correct' | 'wrong' | 'combo' | null>(null)
  const [typingGoal, setTypingGoal] = useState(10) // 목표 점수
  const [typingProgress, setTypingProgress] = useState(0) // 진행도 (0-100)
  const typingIntervalRef = useRef<number | null>(null)
  const typingInputRef = useRef<HTMLInputElement | null>(null)
  const typingCompositionRef = useRef(false) // 한글 입력 중인지 확인
  
  // 떨어지는 글자 게임 관련
  const [fallingLetters, setFallingLetters] = useState<Array<{id: string, letter: string, x: number, y: number, speed: number}>>([])
  const fallingAnimationRef = useRef<number | null>(null)
  const fallingSpawnTimeoutRef = useRef<number | null>(null)
  const gameAreaRef = useRef<HTMLDivElement | null>(null)
  
  // 활 쏘기 게임 관련
  const [archeryTargets, setArcheryTargets] = useState<Array<{id: string, letter: string, x: number, y: number, appearTime: number}>>([])
  const [arrows, setArrows] = useState<Array<{id: string, x: number, y: number, targetLetter: string}>>([])
  const [palanquinPosition, setPalanquinPosition] = useState(0) // 가마 위치
  const archeryAnimationRef = useRef<number | null>(null)
  const archerySpawnTimeoutRef = useRef<number | null>(null)

  // 낱말 학습 관련
  const [selectedWord, setSelectedWord] = useState<{word: string, meaning: string} | null>(null)
  const [userSentence, setUserSentence] = useState('')
  const [wordFeedback, setWordFeedback] = useState<string | null>(null)
  const [submittingWord, setSubmittingWord] = useState(false)
  const [displayedWords, setDisplayedWords] = useState<Array<{word: string, meaning: string}>>([])
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  // 순 우리말 낱말 데이터 (처음 5개는 교과서 단어)
  const koreanWords = [
    { word: '도담도담', meaning: '어린아이가 탈 없이 잘 놀며 자라는 모양' },
    { word: '팔랑팔랑', meaning: '나뭇잎이나 나비 따위가 가볍게 계속 날아다니는 모양' },
    { word: '쪼로니', meaning: '비교적 작은 것들이 나란히 있는 모양' },
    { word: '또랑또랑', meaning: '조금도 흐리지 않고 아주 밝고 똑똑한 모양' },
    { word: '와그르르', meaning: '담겨 있던 물건들이 갑자기 쏟아지는 소리' }
  ]

  // API 상태 확인
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const res = await fetch('/.netlify/functions/health')
        if (res.ok) {
          setApiStatus('online')
        } else {
          setApiStatus('offline')
        }
      } catch {
        setApiStatus('offline')
      }
    }
    
    checkApiStatus()
    const interval = setInterval(checkApiStatus, 30000) // 30초마다 확인
    return () => clearInterval(interval)
  }, [])

  // 학생 목록 불러오기 함수
  const fetchStudentList = async () => {
    try {
      setFetchingStudents(true)
      const students = await getAllStudents()
      console.log('Fetched students:', students)
      setAllStudents(students)
    } catch (e) {
      console.error('Failed to fetch student list:', e)
    } finally {
      setFetchingStudents(false)
    }
  }

  // 학생 목록 초기 불러오기
  useEffect(() => {
    fetchStudentList()
    
    // 이미 로그인된 상태라면 역할 확인
    if (student && !userRole) {
      getUserRole(student.uid).then(role => {
        if (role) setUserRole(role)
      })
    }
  }, [student])

  // Firebase 인증 상태 확인 및 학생 정보 로드
  useEffect(() => {
    // 5초 후에도 응답이 없으면 강제로 로딩 해제 (네트워크 오류나 도메인 미등록 대비)
    const timeout = setTimeout(() => {
      if (authLoading) {
        setAuthLoading(false)
        console.warn('Auth state check timed out. Showing login screen.')
      }
    }, 5000)

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout)
      if (user) {
        const studentData: Student = {
          uid: user.uid,
          name: user.displayName || '학생',
          email: user.email || '',
          photoURL: user.photoURL || undefined
        }
        setStudent(studentData)
        
        // 사용자 역할(교사/학생) 불러오기
        try {
          const role = await getUserRole(user.uid)
          if (role) {
            setUserRole(role)
          }
        } catch (e) {
          console.error('Failed to get user role:', e)
        }
        
        // 학생 목록에 추가/업데이트
        try {
          await saveStudent(studentData)
          await fetchStudentList()
        } catch (e) {
          console.error('Failed to save/load students:', e)
        }
      } else {
        setStudent(null)
        setUserRole(null)
      }
      setAuthLoading(false)
    })
    
    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  // 대화하기 모드 진입 시 초기 인삿말 추가
  useEffect(() => {
    if (mode === 'chat' && messages.length === 0) {
      const greetingMessage: Message = {
        id: 'greeting-' + Date.now(),
        role: 'assistant',
        content: '안녕하느냐! 나는 세종대왕이다. 무엇이든 물어보거라. 한글이나 조선의 역사, 문화에 대해 궁금한 것이 있으면 언제든 말해도 좋다.',
        createdAt: new Date().toISOString()
      }
      setMessages([greetingMessage])
    }
  }, [mode])

  // 편지함 모드 진입 시 편지 다시 불러오기
  useEffect(() => {
    if (mode === 'inbox' && student) {
      getLetters(student.uid).then(letters => {
        setSavedLetters(letters)
      }).catch(e => {
        console.error('Failed to load letters:', e)
      })
    }
  }, [mode, student])

  // Canvas에 글자 그리기
  useEffect(() => {
    if (mode === 'decorate' && selectedLetter && decorateCanvasRef.current) {
      const canvas = decorateCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Canvas가 완전히 렌더링될 때까지 대기
      const drawLetter = () => {
        // Canvas 초기화
        const displayWidth = canvas.offsetWidth || canvas.clientWidth || 800
        const displayHeight = canvas.offsetHeight || canvas.clientHeight || 800
        const scale = window.devicePixelRatio || 1
        canvas.width = displayWidth * scale
        canvas.height = displayHeight * scale
        ctx.scale(scale, scale)
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, displayWidth, displayHeight)

        // 글자체 설정
        const fontMap: Record<string, string> = {
          'Gungsuh': 'Gungsuh',
          'Nanum Gothic': 'Nanum Gothic',
          'Nanum Pen Script': 'Nanum Pen Script',
          'Jua': 'Jua'
        }
        
        // 글자 크기를 실제 Canvas 크기에 맞춤
        let fontFamilyStr = ''
        if (fontFamily === 'Nanum Gothic') {
          fontFamilyStr = `"${fontMap[fontFamily]}", sans-serif`
        } else if (fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
          fontFamilyStr = `"${fontMap[fontFamily]}", cursive`
        } else if (fontFamily === 'Gungsuh') {
          fontFamilyStr = `"${fontMap[fontFamily]}", "GungsuhChe", "궁서", "궁서체", serif`
        } else {
          fontFamilyStr = `"${fontMap[fontFamily]}", serif`
        }
        let fontSize = Math.min(displayWidth, displayHeight) * 0.7
        // 나눔펜과 주아체의 경우 글자 크기를 더 크게
        if (fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
          fontSize = Math.min(displayWidth, displayHeight) * 0.95
        }
        ctx.font = `${fontSize}px ${fontFamilyStr}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // 나눔고딕, 나눔펜, 주아체의 경우 fill도 추가하여 색칠 공간 넓히기
        if (fontFamily === 'Nanum Gothic' || fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
          // 먼저 fill로 그려서 색칠 가능하도록
          ctx.fillStyle = 'rgba(0, 0, 0, 0.01)'
          ctx.fillText(selectedLetter, displayWidth / 2, displayHeight / 2)
          // 테두리 그리기
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = strokeWidth
          ctx.strokeText(selectedLetter, displayWidth / 2, displayHeight / 2)
        } else {
          // 테두리만 그리기
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = strokeWidth
          ctx.strokeText(selectedLetter, displayWidth / 2, displayHeight / 2)
        }
      }

      // requestAnimationFrame을 사용하여 다음 프레임에 그리기
      requestAnimationFrame(() => {
        requestAnimationFrame(drawLetter)
      })
    }
  }, [mode, selectedLetter, strokeColor, strokeWidth, fontFamily])

  const isPointInLetter = (x: number, y: number): boolean => {
    if (!decorateCanvasRef.current || !selectedLetter) return false
    const canvas = decorateCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    const displayWidth = canvas.offsetWidth || canvas.clientWidth || 800
    const displayHeight = canvas.offsetHeight || canvas.clientHeight || 800
    
    // 글자 크기 계산
    let fontSize = Math.min(displayWidth, displayHeight) * 0.7
    if (fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
      fontSize = Math.min(displayWidth, displayHeight) * 0.95
    }
    
    // 글자 중심점
    const centerX = displayWidth / 2
    const centerY = displayHeight / 2
    
    // 글자 중심점 근처 넓은 영역 허용 (글자 크기의 6배 = 기존 3배의 200%)
    const letterWidth = fontSize * 6.0
    const letterHeight = fontSize * 6.0
    const left = centerX - letterWidth / 2
    const right = centerX + letterWidth / 2
    const top = centerY - letterHeight / 2
    const bottom = centerY + letterHeight / 2
    
    return x >= left && x <= right && y >= top && y <= bottom
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!decorateCanvasRef.current) return
    const canvas = decorateCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isPointInLetter(x, y)) {
      setIsPainting(true)
      paintAt(x, y)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting || !decorateCanvasRef.current) return
    const canvas = decorateCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isPointInLetter(x, y)) {
      paintAt(x, y)
    }
  }

  const handleCanvasMouseUp = () => {
    setIsPainting(false)
  }

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!decorateCanvasRef.current) return
    const canvas = decorateCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    if (isPointInLetter(x, y)) {
      setIsPainting(true)
      paintAt(x, y)
    }
  }

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isPainting || !decorateCanvasRef.current) return
    const canvas = decorateCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    if (isPointInLetter(x, y)) {
      paintAt(x, y)
    }
  }

  const handleCanvasTouchEnd = () => {
    setIsPainting(false)
  }

  const paintAt = (x: number, y: number) => {
    if (!decorateCanvasRef.current) return
    const canvas = decorateCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = fillColor
    } else {
      ctx.globalCompositeOperation = 'destination-out'
    }

    // 붓 크기를 더 크게 하여 넓은 영역 색칠
    const effectiveBrushSize = brushSize * 1.5
    ctx.beginPath()
    ctx.arc(x, y, effectiveBrushSize / 2, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }

  const handleClearCanvas = () => {
    if (!decorateCanvasRef.current || !selectedLetter) return
    const canvas = decorateCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas 초기화
    const displayWidth = canvas.offsetWidth || canvas.clientWidth || 800
    const displayHeight = canvas.offsetHeight || canvas.clientHeight || 800
    const scale = window.devicePixelRatio || 1
    canvas.width = displayWidth * scale
    canvas.height = displayHeight * scale
    ctx.scale(scale, scale)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // 글자 테두리 다시 그리기
    const fontMap: Record<string, string> = {
      'Gungsuh': 'Gungsuh',
      'Nanum Gothic': 'Nanum Gothic',
      'Nanum Pen Script': 'Nanum Pen Script',
      'Jua': 'Jua'
    }
    let fontFamilyStr = ''
    if (fontFamily === 'Nanum Gothic') {
      fontFamilyStr = `"${fontMap[fontFamily]}", sans-serif`
    } else if (fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
      fontFamilyStr = `"${fontMap[fontFamily]}", cursive`
    } else if (fontFamily === 'Gungsuh') {
      fontFamilyStr = `"${fontMap[fontFamily]}", "GungsuhChe", "궁서", "궁서체", serif`
    } else {
      fontFamilyStr = `"${fontMap[fontFamily]}", serif`
    }
        let fontSize = Math.min(displayWidth, displayHeight) * 0.7
        // 나눔펜과 주아체의 경우 글자 크기를 더 크게
        if (fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
          fontSize = Math.min(displayWidth, displayHeight) * 0.95
        }
        ctx.font = `${fontSize}px ${fontFamilyStr}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // 나눔고딕, 나눔펜, 주아체의 경우 fill도 추가하여 색칠 공간 넓히기
        if (fontFamily === 'Nanum Gothic' || fontFamily === 'Nanum Pen Script' || fontFamily === 'Jua') {
      // 먼저 fill로 그려서 색칠 가능하도록
      ctx.fillStyle = 'rgba(0, 0, 0, 0.01)'
      ctx.fillText(selectedLetter, displayWidth / 2, displayHeight / 2)
      // 테두리 그리기
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.strokeText(selectedLetter, displayWidth / 2, displayHeight / 2)
    } else {
      // 테두리만 그리기
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.strokeText(selectedLetter, displayWidth / 2, displayHeight / 2)
    }
  }

  const handleSaveDecoratedLetter = () => {
    if (!selectedLetter.trim()) {
      alert('글자를 선택해주세요.')
      return
    }
    
    // 한글인지 확인
    if (!/[가-힣]/.test(selectedLetter)) {
      alert('한글 한 글자를 입력해주세요.')
      return
    }

    if (!decorateCanvasRef.current) {
      alert('그림을 그려주세요.')
      return
    }

    const dataUrl = decorateCanvasRef.current.toDataURL('image/png')
    
    const newDecorated = {
      id: crypto.randomUUID(),
      letter: selectedLetter,
      dataUrl: dataUrl,
      createdAt: new Date().toISOString()
    }

    const updated = [...decoratedLetters, newDecorated]
    setDecoratedLetters(updated)
    
    if (student) {
      saveDecoratedLetter(student.uid, newDecorated).catch(e => {
        console.error('Failed to save decorated letter:', e)
        alert('저장에 실패했습니다.')
      })
    }
    
    alert('꾸민 글자가 저장되었습니다!')
  }

  const handleDeleteDecoratedLetter = async (id: string) => {
    if (!confirm('이 작품을 삭제하시겠습니까?')) {
      return
    }

    const updated = decoratedLetters.filter(item => item.id !== id)
    setDecoratedLetters(updated)
    
    if (student) {
      try {
        await deleteDecoratedLetter(student.uid, id)
      } catch (e) {
        console.error('Failed to delete decorated letter:', e)
        alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleDownloadDecoratedLetter = (item: { id: string; letter: string; dataUrl: string; createdAt: string }) => {
    const link = document.createElement('a')
    link.download = `글자꾸미기_${item.letter}_${new Date(item.createdAt).toISOString().split('T')[0]}.png`
    link.href = item.dataUrl
    link.click()
  }

  // 타자연습 관련 함수들
  const typingWords = [
    '세종대왕', '훈민정음', '한글', '조선', '임금', '과학', '천문학', '측우기',
    '금속활자', '지도', '법률', '문화', '예술', '음악', '집현전', '정치',
    '경제', '발명', '창제', '개량', '제작', '정비', '발전', '설립',
    '백성', '나라', '역사', '전통', '지혜', '학문', '교육', '인재'
  ]

  const typingLetters = [
    '가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하',
    '각', '간', '갈', '감', '강', '개', '거', '건', '걸', '검', '경', '계', '고', '곡',
    '공', '과', '관', '광', '구', '국', '군', '굿', '권', '궁', '귀', '규', '균', '그',
    '극', '근', '글', '금', '급', '기', '긴', '길', '김', '깃', '깊', '깨', '꺼', '껌'
  ]

  const getRandomTarget = () => {
    if (typingMode === 'letter') {
      return typingLetters[Math.floor(Math.random() * typingLetters.length)]
    } else {
      return typingWords[Math.floor(Math.random() * typingWords.length)]
    }
  }

  const startTyping = () => {
    setTypingScore(0)
    setTypingCorrect(0)
    setTypingWrong(0)
    setTypingTime(0)
    setTypingLevel(1)
    setTypingCombo(0)
    setTypingMaxCombo(0)
    setTypingProgress(0)
    setTypingGoal(10)
    setCurrentTarget(getRandomTarget())
    setTypingInput('')
    setFallingLetters([])
    setArcheryTargets([])
    setArrows([])
    setPalanquinPosition(0)
    
    // 상태 업데이트 후 게임 시작
    setIsTypingActive(true)
    
    // 타이머 시작
    typingIntervalRef.current = window.setInterval(() => {
      setTypingTime(prev => prev + 1)
    }, 1000)
    
    // 게임 스타일에 따라 다른 초기화 (상태 업데이트 후 실행)
    setTimeout(() => {
      if (gameStyle === 'falling') {
        startFallingGame()
      } else if (gameStyle === 'archery') {
        startArcheryGame()
      } else {
        // 전통 모드
        typingInputRef.current?.focus()
      }
    }, 50)
  }
  
  // 떨어지는 글자 게임 시작
  const startFallingGame = () => {
    // 첫 글자 즉시 생성
    const availablePositions = [20, 40, 60, 80]
    const x = availablePositions[Math.floor(Math.random() * availablePositions.length)]
    const letter = getRandomTarget()
    const baseSpeed = 0.15
    const levelSpeed = (typingLevel - 1) * 0.03
    const newItem = {
      id: Date.now().toString() + Math.random(),
      letter,
      x: x,
      y: -5,
      speed: baseSpeed + levelSpeed
    }
    setFallingLetters([newItem])
  }
  
  // 떨어지는 글자 애니메이션 루프
  useEffect(() => {
    if (!isTypingActive || gameStyle !== 'falling') {
      // 게임이 비활성화되면 애니메이션 중지 및 모든 글자 제거
      if (fallingAnimationRef.current) {
        cancelAnimationFrame(fallingAnimationRef.current)
        fallingAnimationRef.current = null
      }
      setFallingLetters([])
      return
    }
    
    let lastTime = performance.now()
    
    // 애니메이션 루프 시작
    const animate = (currentTime: number) => {
      // 게임 상태 확인
      if (!isTypingActive || gameStyle !== 'falling') {
        if (fallingAnimationRef.current) {
          cancelAnimationFrame(fallingAnimationRef.current)
          fallingAnimationRef.current = null
        }
        return
      }
      
      const deltaTime = currentTime - lastTime
      lastTime = currentTime
      
      // 프레임 간격이 너무 크면 스킵 (60fps 기준 약 16ms)
      if (deltaTime > 100) {
        fallingAnimationRef.current = requestAnimationFrame(animate)
        return
      }
      
      setFallingLetters(prev => {
        if (prev.length === 0) {
          // 글자가 없으면 애니메이션 계속 (다음 글자 생성 대기)
          fallingAnimationRef.current = requestAnimationFrame(animate)
          return prev
        }
        
        const maxY = 85 // 85% 지점에서 제거
        let missedCount = 0
        
        // deltaTime을 사용하여 부드러운 애니메이션 (초당 픽셀 이동)
        const speedMultiplier = deltaTime / 16 // 60fps 기준 정규화
        const updated = prev.map(item => {
          // 속도를 더 세밀하게 조절 (초등학교 2학년에 맞게)
          const newY = item.y + item.speed * speedMultiplier * 0.5
          if (newY > maxY) {
            missedCount++
            return null
          }
          return { ...item, y: newY }
        }).filter(Boolean) as typeof prev
        
        // 바닥에 닿은 글자 처리
        if (missedCount > 0) {
          setTimeout(() => {
            setTypingWrong(prev => prev + missedCount)
            setTypingCombo(0)
          }, 0)
        }
        
        // 애니메이션 계속
        fallingAnimationRef.current = requestAnimationFrame(animate)
        return updated
      })
    }
    
    // 애니메이션 시작
    lastTime = performance.now()
    fallingAnimationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (fallingAnimationRef.current) {
        cancelAnimationFrame(fallingAnimationRef.current)
        fallingAnimationRef.current = null
      }
    }
  }, [isTypingActive, gameStyle, typingLevel])
  
  // 글자 생성 및 관리 (글자가 사라진 후 다음 글자 생성)
  useEffect(() => {
    if (!isTypingActive || gameStyle !== 'falling') {
      return
    }
    
    // 떨어지는 글자가 없으면 새 글자 생성
    if (fallingLetters.length === 0) {
      const timer = setTimeout(() => {
        // 다시 확인
        if (!isTypingActive || gameStyle !== 'falling') return
        
        // 사용 가능한 위치 목록 (랜덤 선택)
        const availablePositions = [20, 40, 60, 80]
        const x = availablePositions[Math.floor(Math.random() * availablePositions.length)]
        
        // 일반 글자 생성
        const letter = getRandomTarget()
        const baseSpeed = 0.15
        const levelSpeed = (typingLevel - 1) * 0.03
        const newItem = {
          id: Date.now().toString() + Math.random(),
          letter,
          x: x,
          y: -5,
          speed: baseSpeed + levelSpeed
        }
        
        setFallingLetters([newItem])
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [fallingLetters.length, isTypingActive, gameStyle, typingLevel])
  
  // 활 쏘기 게임 시작
  const startArcheryGame = () => {
    const spawnTarget = () => {
      // isTypingActive를 함수 내부에서 체크
      setArcheryTargets(prev => {
        // 게임이 비활성화되었으면 중단
        if (!isTypingActive) {
          if (archerySpawnTimeoutRef.current) {
            clearTimeout(archerySpawnTimeoutRef.current)
            archerySpawnTimeoutRef.current = null
          }
          return prev
        }
        
        // 현재 화면에 있는 타겟들의 정확한 위치 확인
        const currentPositions = prev.map(target => ({
          x: target.x,
          y: target.y
        }))
        
        // 사용 가능한 위치 그리드 (더 넓은 간격)
        const availableXPositions = [15, 35, 55, 75] // 4개 x 위치 (20% 간격)
        const availableYPositions = [20, 40, 60] // 3개 y 위치 (20% 간격)
        
        // 겹치지 않는 위치 찾기
        let foundPosition = false
        let x = 0
        let y = 0
        
        // 모든 가능한 위치 조합 생성
        const allPositions: Array<{x: number, y: number}> = []
        availableXPositions.forEach(xPos => {
          availableYPositions.forEach(yPos => {
            allPositions.push({ x: xPos, y: yPos })
          })
        })
        
        // 랜덤하게 섞기
        const shuffledPositions = allPositions.sort(() => Math.random() - 0.5)
        
        // 사용 가능한 위치 찾기 (최소 20% 이상 떨어진 위치)
        for (const pos of shuffledPositions) {
          // 현재 타겟들과 최소 20% 이상 떨어져 있는지 확인
          const isFarEnough = !currentPositions.some(used => 
            Math.abs(used.x - pos.x) < 20 || Math.abs(used.y - pos.y) < 20
          )
          
          if (isFarEnough) {
            x = pos.x
            y = pos.y
            foundPosition = true
            break
          }
        }
        
        // 위치를 찾지 못했으면 생성하지 않음 (다음 기회에)
        if (!foundPosition) {
          const nextSpawn = Math.max(2000 - (typingLevel * 100), 1200)
          archerySpawnTimeoutRef.current = window.setTimeout(spawnTarget, nextSpawn)
          return prev
        }
        
        const letter = getRandomTarget()
        const newTarget = {
          id: Date.now().toString() + Math.random(),
          letter,
          x: x,
          y: y,
          appearTime: Date.now()
        }
        
        // 다음 타겟 생성
        const nextSpawn = Math.max(2500 - (typingLevel * 100), 1500) // 간격을 더 늘림
        archerySpawnTimeoutRef.current = window.setTimeout(spawnTarget, nextSpawn)
        
        return [...prev, newTarget]
      })
    }
    
    // 첫 타겟 생성 (약간의 지연 후)
    setTimeout(() => {
      spawnTarget()
    }, 500)
    animateArchery()
  }
  
  // 활 쏘기 애니메이션
  const animateArchery = () => {
    const animate = () => {
      if (!isTypingActive) {
        if (archeryAnimationRef.current) {
          cancelAnimationFrame(archeryAnimationRef.current)
          archeryAnimationRef.current = null
        }
        return
      }
      
      // 가마 이동
      setPalanquinPosition(prev => (prev + 0.3) % 100)
      
      // 화살 이동
      setArrows(prev => prev.map(arrow => ({
        ...arrow,
        y: arrow.y - 2
      })).filter(arrow => arrow.y > -10))
      
      // 타겟 시간 초과 체크 (5초 후 사라짐)
      setArcheryTargets(prev => {
        const now = Date.now()
        const filtered = prev.filter(target => now - target.appearTime < 5000)
        const missedCount = prev.length - filtered.length
        
        if (missedCount > 0) {
          // 타겟이 사라지면 오답 처리
          setTimeout(() => {
            setTypingWrong(prev => prev + missedCount)
            setTypingCombo(0)
          }, 0)
        }
        
        return filtered
      })
      
      archeryAnimationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
  }
  
  // 활 쏘기
  const shootArrow = (targetLetter: string) => {
    const newArrow = {
      id: Date.now().toString() + Math.random(),
      x: palanquinPosition, // 가마 위치에서 발사
      y: 80, // 하단에서 발사
      targetLetter
    }
    setArrows(prev => [...prev, newArrow])
    
    // 타겟과 충돌 체크
    setArcheryTargets(prev => {
      const hitTarget = prev.find(t => t.letter === targetLetter)
      if (hitTarget) {
        // 정답 처리
        handleCorrectAnswer()
        return prev.filter(t => t.id !== hitTarget.id)
      }
      return prev
    })
  }
  
  // 정답 처리 공통 함수
  const handleCorrectAnswer = () => {
    const newCombo = typingCombo + 1
    const newCorrect = typingCorrect + 1
    const newScore = typingScore + 1
    const bonus = newCombo >= 5 ? Math.floor(newCombo / 5) : 0
    const finalScore = newScore + bonus
    
    setTypingScore(finalScore)
    setTypingCorrect(newCorrect)
    setTypingCombo(newCombo)
    if (newCombo > typingMaxCombo) {
      setTypingMaxCombo(newCombo)
    }
    
    const newLevel = Math.floor(finalScore / 10) + 1
    if (newLevel > typingLevel) {
      setTypingLevel(newLevel)
      showFeedback(`레벨 ${newLevel} 달성! 🎉`, 'combo')
    } else if (newCombo >= 10) {
      showFeedback(`${newCombo}연속 정답! 🔥`, 'combo')
    } else if (newCombo >= 5) {
      showFeedback(`${newCombo}연속 정답! +${bonus}점`, 'combo')
    } else {
      showFeedback('정답! ✓', 'correct')
    }
    
    const newProgress = Math.min((finalScore / typingGoal) * 100, 100)
    setTypingProgress(newProgress)
    
    if (finalScore >= typingGoal) {
      setTypingGoal(prev => prev + 10)
      showFeedback(`목표 달성! 다음 목표: ${typingGoal + 10}점`, 'combo')
    }
    
    setTypingInput('')
    setCurrentTarget(getRandomTarget())
  }

  const stopTyping = () => {
    setIsTypingActive(false)
    
    // 타자 연습 결과 저장 (점수가 0보다 크고 학생일 때만)
    if (student && userRole !== 'teacher' && typingScore > 0) {
      const typingResult: TypingResult = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        score: typingScore,
        correct: typingCorrect,
        wrong: typingWrong,
        level: typingLevel,
        mode: gameStyle
      }
      
      saveTypingResult(student.uid, typingResult).catch(e => {
        console.error('Failed to save typing result:', e)
      })
    }
    
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
      typingIntervalRef.current = null
    }
    if (fallingAnimationRef.current) {
      cancelAnimationFrame(fallingAnimationRef.current)
      fallingAnimationRef.current = null
    }
    if (fallingSpawnTimeoutRef.current) {
      clearTimeout(fallingSpawnTimeoutRef.current)
      fallingSpawnTimeoutRef.current = null
    }
    if (archeryAnimationRef.current) {
      cancelAnimationFrame(archeryAnimationRef.current)
      archeryAnimationRef.current = null
    }
    if (archerySpawnTimeoutRef.current) {
      clearTimeout(archerySpawnTimeoutRef.current)
      archerySpawnTimeoutRef.current = null
    }
  }

  const resetTyping = () => {
    stopTyping()
    setTypingScore(0)
    setTypingCorrect(0)
    setTypingWrong(0)
    setTypingTime(0)
    setTypingLevel(1)
    setTypingCombo(0)
    setTypingMaxCombo(0)
    setTypingProgress(0)
    setTypingGoal(10)
    setTypingFeedback(null)
    setTypingFeedbackType(null)
    setCurrentTarget('')
    setTypingInput('')
    setFallingLetters([])
    setArcheryTargets([])
    setArrows([])
    setPalanquinPosition(0)
    if (fallingAnimationRef.current) {
      cancelAnimationFrame(fallingAnimationRef.current)
      fallingAnimationRef.current = null
    }
    if (archeryAnimationRef.current) {
      cancelAnimationFrame(archeryAnimationRef.current)
      archeryAnimationRef.current = null
    }
  }

  const showFeedback = (message: string, type: 'correct' | 'wrong' | 'combo') => {
    setTypingFeedback(message)
    setTypingFeedbackType(type)
    setTimeout(() => {
      setTypingFeedback(null)
      setTypingFeedbackType(null)
    }, 1500)
  }

  const handleTypingInput = (value: string) => {
    // 항상 입력값은 업데이트 (화면에 표시되도록)
    setTypingInput(value)
    
    // 한글 입력 중이면 검증 로직만 건너뛰기
    if (typingCompositionRef.current) {
      return
    }
    
    if (!isTypingActive && value.length > 0) {
      startTyping()
      return
    }
    
    if (!isTypingActive) {
      return
    }
    
    // 떨어지는 글자 게임 모드
    if (gameStyle === 'falling') {
      if (value.length === 0) return
      
      // 글자 체크
      const matchingLetter = fallingLetters.find(l => l.letter === value)
      if (matchingLetter) {
        // 정답 - 해당 글자 제거
        setFallingLetters(prev => prev.filter(l => l.id !== matchingLetter.id))
        handleCorrectAnswer()
        setTypingInput('')
        return
      } else {
        // 오답
        setTypingWrong(prev => prev + 1)
        setTypingCombo(0)
        showFeedback('틀렸어요!', 'wrong')
        setTypingInput('')
        return
      }
    }
    
    // 활 쏘기 게임 모드
    if (gameStyle === 'archery') {
      const matchingTarget = archeryTargets.find(t => t.letter === value)
      if (matchingTarget) {
        // 활 쏘기
        shootArrow(value)
        handleCorrectAnswer()
        setTypingInput('')
        return
      } else if (value.length > 0) {
        // 오답
        setTypingWrong(prev => prev + 1)
        setTypingCombo(0)
        showFeedback('틀렸어요!', 'wrong')
        setTypingInput('')
        return
      }
      return
    }
    
    // 전통 모드
    if (value === currentTarget) {
      handleCorrectAnswer()
      setTimeout(() => {
        typingInputRef.current?.focus()
      }, 50)
    } else if (value.length >= currentTarget.length && value !== currentTarget) {
      // 오답
      setTypingWrong(prev => prev + 1)
      setTypingCombo(0) // 연속 정답 초기화
      showFeedback('틀렸어요! 다시 시도해보세요', 'wrong')
      setTypingInput('')
      setCurrentTarget(getRandomTarget())
      setTimeout(() => {
        typingInputRef.current?.focus()
      }, 50)
    }
  }

  const handleCompositionStart = () => {
    typingCompositionRef.current = true
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    typingCompositionRef.current = false
    // composition이 끝난 후에 검증
    const value = e.currentTarget.value
    if (value === currentTarget) {
      handleTypingInput(value)
    } else if (value.length >= currentTarget.length && value !== currentTarget) {
      handleTypingInput(value)
    }
  }

  // 게임 스타일과 활성 상태에 따라 게임 시작
  useEffect(() => {
    if (!isTypingActive) return
    
    // 게임이 이미 시작되었는지 확인
    const gameStarted = (gameStyle === 'falling' && fallingLetters.length > 0) || 
                        (gameStyle === 'archery' && archeryTargets.length > 0) ||
                        (gameStyle === 'classic')
    
    if (gameStarted) return
    
    if (gameStyle === 'falling') {
      // 떨어지는 글자 게임 시작
      const timer = setTimeout(() => {
        startFallingGame()
      }, 200)
      return () => clearTimeout(timer)
    } else if (gameStyle === 'archery') {
      // 활 쏘기 게임 시작
      const timer = setTimeout(() => {
        startArcheryGame()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isTypingActive, gameStyle])

  // 타자연습 모드 초기화
  useEffect(() => {
    if (mode === 'typing') {
      resetTyping()
    }
    
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
      }
    }
  }, [mode, typingMode])

  // 학습 모드 초기화
  useEffect(() => {
    if (mode === 'learn') {
      const items: LearnItem[] = [
        { id: '1', icon: '/hunmin.png', name: '훈민정음', description: '우리말을 쓸 수 있도록 한글을 만들어냈어요.' },
        { id: '2', icon: '/haesigye.png', name: '해시계 (앙부일구)', description: '시간을 정확히 알 수 있는 해시계를 만들었어요.' },
        { id: '3', icon: '/chkugi.png', name: '측우기', description: '비의 양을 재는 측우기를 만들어 농사에 도움을 줬어요.' }
      ]
      setAllLearnItems(items)
      setCurrentPage(0)
      setDroppedItems({})
      setLearnSaved(false)
      setShowLearnFeedback(false)
    }
  }, [mode])

  // 현재 페이지의 항목 표시 및 드래그 아이템 섞기
  useEffect(() => {
    if (mode === 'learn' && allLearnItems.length > 0) {
      const startIndex = currentPage * 4
      const endIndex = startIndex + 4
      const currentItems = allLearnItems.slice(startIndex, endIndex)
      setLearnItems(currentItems)
      
      // 현재 페이지의 드롭 상태 초기화 (페이지 변경 시에만)
      setDroppedItems({})
      
      // 드래그 아이템 (이름과 설명을 분리하여 섞기)
      const dragItems: Array<{ id: string; type: 'name' | 'description'; text: string }> = []
      currentItems.forEach(item => {
        dragItems.push({ id: item.id, type: 'name', text: item.name })
        dragItems.push({ id: item.id, type: 'description', text: item.description })
      })
      
      const shuffled = [...dragItems].sort(() => Math.random() - 0.5)
      setShuffledDragItems(shuffled)
    }
  }, [mode, allLearnItems, currentPage])

  // 학습 결과 저장 로직 (이름/설명 매칭이 모두 완료되고 정답 확인을 눌렀을 때)
  useEffect(() => {
    // 학생이고, 학습 모드이며, 정답 확인 상태이고, 아직 저장되지 않았을 때
    if (mode === 'learn' && allLearnItems.length > 0 && showLearnFeedback && !learnSaved && student && userRole !== 'teacher') {
      // 모든 항목이 올바르게 채워졌는지 확인
      const isAllCorrect = allLearnItems.every(item => 
        _droppedItems[item.id]?.name?.sourceId === item.id && 
        _droppedItems[item.id]?.description?.sourceId === item.id
      )
      
      if (isAllCorrect) {
        const result: LearnResult = {
          id: Date.now().toString(),
          completedAt: new Date().toISOString(),
          items: allLearnItems.map(item => item.name)
        }
        
        saveLearnResult(student.uid, result).then(() => {
          setLearnSaved(true);
          getLearnResults(student.uid).then(results => {
            setLearnResults(results);
          });
        }).catch(e => {
          console.error('Failed to save learn result:', e);
        })
      }
    }
  }, [mode, allLearnItems, _droppedItems, learnSaved, showLearnFeedback, student, userRole])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || submitting) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSubmitting(true)
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

      // 한 대화(세션)를 하나의 문서로 유지하기 위한 Firestore 저장 로직
      if (student) {
        const updatedMessages = [...messages, userMessage, assistantMessage]

        // 아직 세션이 없다면 새로 생성
        if (!currentChatSessionId) {
          const newSession: ChatSession = {
            id: crypto.randomUUID(),
            messages: updatedMessages,
            createdAt: new Date().toISOString(),
          }

          try {
            const sessionId = await createChatSession(student.uid, newSession)
            setCurrentChatSessionId(sessionId)
            const updatedSessions = [...chatSessions, { ...newSession, id: sessionId }]
            setChatSessions(updatedSessions)
          } catch (e) {
            console.error('Failed to create chat session:', e)
          }
        } else {
          // 기존 세션이 있다면 같은 문서를 업데이트
          try {
            await updateChatSession(student.uid, currentChatSessionId, updatedMessages)
            const updatedSessions = chatSessions.map(session =>
              session.id === currentChatSessionId
                ? { ...session, messages: updatedMessages }
                : session
            )
            setChatSessions(updatedSessions)
          } catch (e) {
            console.error('Failed to update chat session:', e)
          }
        }
      }
    } catch (err) {
      console.error(err)
      setError('답변을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendLetter = async () => {
    if (!letterContent.trim() || sendingLetter) return

    setSendingLetter(true)
    setError(null)

    const letterText = letterContent.trim()
    setLetterContent('')

    try {
      // 세종대왕에게 편지 보내기
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'letter',
          messages: [
            {
              role: 'user',
              content: letterText
            }
          ]
        }),
      })

      if (!res.ok) {
        throw new Error('서버 통신 중 오류가 발생했습니다.')
      }

      const data = await res.json()
      const reply = data.reply ?? '죄송하네, 방금 답변을 가져오지 못했소.'

      const newLetter: Letter = {
        id: crypto.randomUUID(),
        content: letterText,
        reply: reply,
        createdAt: new Date().toISOString(),
      }

      // 편지쓰기 화면에 표시
      setCurrentLetter(newLetter)

      // 편지함에 저장
      if (student) {
        await saveLetter(student.uid, newLetter)
        const updated = [...savedLetters, newLetter]
        setSavedLetters(updated)
      }
    } catch (err) {
      console.error(err)
      setError('편지를 보내지 못했어요. 잠시 후 다시 시도해주세요.')
      setLetterContent(letterText) // 실패 시 내용 복구
    } finally {
      setSendingLetter(false)
    }
  }

  // 구글 로그인 핸들러
  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      await signInWithPopup(auth, googleProvider)
      // 로그인 성공 시 onAuthStateChanged에서 처리됨
    } catch (error) {
      console.error('Google login error:', error)
      setError('로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelect = async (role: 'student' | 'teacher') => {
    if (student) {
      try {
        setUserRole(role)
        await saveUserRole(student.uid, role)
      } catch (e) {
        console.error('Failed to save user role:', e)
      }
    }
  }

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student)
    // 선택한 학생의 활동 결과 불러오기
    try {
      const [letters, chats, learnResults, typingResults] = await Promise.all([
        getLetters(student.uid),
        getChatSessions(student.uid),
        getLearnResults(student.uid),
        getTypingResults(student.uid)
      ])
      
      const activity: StudentActivity = {
        letters,
        chatSessions: chats,
        learnResults,
        typingResults
      }
      setStudentActivity(activity)
    } catch (e) {
      console.error('Failed to load student activity:', e)
      setStudentActivity({
        letters: [],
        chatSessions: [],
        learnResults: [],
        typingResults: []
      })
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setStudent(null)
      setUserRole(null)
      setSelectedStudent(null)
      setStudentActivity(null)
      setMessages([])
      setSavedLetters([])
      setChatSessions([])
      setLearnResults([])
      setCurrentChatSessionId(null)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode)

    // 낱말 학습 모드로 전환 시 처음에는 교과서 이미지 5개, 이후엔 랜덤
    if (newMode === 'word') {
      if (isFirstLoad) {
        setDisplayedWords(koreanWords.slice(0, 5)) // 처음 5개 (이미지 있는 단어들)
        setIsFirstLoad(false)
      } else {
        const shuffled = [...koreanWords].sort(() => Math.random() - 0.5)
        setDisplayedWords(shuffled.slice(0, 5))
      }
      setSelectedWord(null)
      setUserSentence('')
      setWordFeedback(null)
    }
  }

  // 1. 초기 로딩 중
  if (authLoading) {
    return (
      <div className="app-root" style={{
        backgroundImage: 'url(/firstpage.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '2rem',
          borderRadius: '1rem',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--traditional-blue)'
        }}>
          불러오는 중...
        </div>
      </div>
    )
  }

  // 2. 로그인이 안 된 경우 - 로그인 화면 표시
  if (!student) {
    return (
      <div className="app-root" style={{
        backgroundImage: 'url(/firstpage.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '3rem',
          borderRadius: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          textAlign: 'center',
          minWidth: '400px'
        }}>
          <h1 style={{ marginBottom: '1rem', fontSize: '2rem', color: 'var(--traditional-blue)' }}>한국 전통 문화 체험</h1>
          <p style={{ marginBottom: '2rem', fontSize: '1.2rem', color: '#666' }}>Sejong Culture Experience</p>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              background: '#4285F4',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1.2rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '로그인 중...' : 'Google 로그인'}
          </button>
          {error && (
            <div style={{ marginTop: '1rem', color: 'var(--traditional-red)', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 3. 로그인은 됐는데 역할이 없는 경우 - 역할 선택 화면
  if (!userRole) {
    return (
      <div className="app-root" style={{
        backgroundImage: 'url(/firstpage.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '3rem',
          borderRadius: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          textAlign: 'center',
          minWidth: '400px'
        }}>
          <h2 style={{ marginBottom: '2rem', fontSize: '1.8rem' }}>역할을 선택해주세요</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => handleRoleSelect('student')}
              style={{
                padding: '1.5rem',
                background: 'var(--traditional-green)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.3rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              학생으로 시작하기
            </button>
            <button
              onClick={() => handleRoleSelect('teacher')}
              style={{
                padding: '1.5rem',
                background: 'var(--traditional-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.3rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              교사로 시작하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 4. 교사인 경우 - 교사 화면
  if (userRole === 'teacher') {
    return (
      <div className="app-root">
        <div className="sidebar-menu">
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#666', fontWeight: 700, textShadow: 'none', lineHeight: '1.4', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--traditional-red)', marginRight: '0.5rem', fontSize: '1.4rem' }}>✿</span>교사 화면
            </h1>
            <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', color: '#666', fontWeight: 600, textShadow: 'none', lineHeight: '1.4', whiteSpace: 'nowrap' }}>학생 활동 관리</p>
          </div>
          <div style={{ height: '8px', display: 'flex', width: '100%', margin: '0 0 1.5rem 0' }}>
            <div style={{ flex: 1, background: 'var(--traditional-red)' }}></div>
            <div style={{ flex: 1, background: 'var(--traditional-blue)' }}></div>
            <div style={{ flex: 1, background: 'var(--traditional-yellow)' }}></div>
            <div style={{ flex: 1, background: 'var(--traditional-green)' }}></div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.8rem',
                background: '#f5f5f5',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#333'
              }}
            >
              로그아웃
            </button>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '0.5rem' 
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>학생 선택</div>
            <button 
              onClick={fetchStudentList}
              disabled={fetchingStudents}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--traditional-blue)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              {fetchingStudents ? '...' : '🔄 새로고침'}
            </button>
          </div>
          {fetchingStudents && (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#666', fontSize: '0.9rem' }}>
              목록을 불러오는 중...
            </div>
          )}
          {!fetchingStudents && allStudents.length === 0 && (
            <div style={{ 
              padding: '1.5rem 1rem', 
              background: '#fff9e6', 
              border: '1px solid var(--traditional-yellow)', 
              borderRadius: '0.5rem', 
              marginBottom: '1rem',
              fontSize: '0.9rem',
              color: '#666',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📢</div>
              등록된 학생이 없습니다.<br/>
              <span style={{ fontSize: '0.8rem', marginTop: '0.5rem', display: 'block', color: '#999' }}>
                (학생들이 먼저 로그인을 해야 목록에 나타납니다.)
              </span>
            </div>
          )}
          {allStudents.length > 0 && !selectedStudent && (
            <div style={{ 
              padding: '1rem', 
              background: '#e8f5e9', 
              border: '1px solid var(--traditional-green)', 
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.9rem',
              color: '#2e7d32',
              textAlign: 'center'
            }}>
              아래 목록에서 학생을 선택해주세요.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allStudents.map((s) => (
              <button
                key={s.uid}
                onClick={() => handleSelectStudent(s)}
                style={{
                  padding: '1rem',
                  background: selectedStudent?.uid === s.uid ? 'var(--traditional-blue)' : 'white',
                  color: selectedStudent?.uid === s.uid ? 'white' : '#333',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  transition: 'all 0.2s',
                  boxShadow: selectedStudent?.uid === s.uid ? '0 4px 12px rgba(40, 77, 117, 0.2)' : 'none'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: selectedStudent?.uid === s.uid ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  overflow: 'hidden'
                }}>
                  {s.photoURL ? <img src={s.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (s.name?.[0] || '학')}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      <div className="chat-container">
          {selectedStudent ? (
            <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>{selectedStudent.name} 학생의 활동 결과</h2>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--traditional-green)' }}>편지 ({studentActivity?.letters.length || 0}개)</h3>
                {studentActivity?.letters.length ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1rem'
                  }}>
                    {studentActivity.letters.map((letter) => {
                      const preview = letter.content.length > 50
                        ? letter.content.substring(0, 50) + '...'
                        : letter.content

                      return (
                        <div
                          key={letter.id}
                          onClick={() => setSelectedLetterDetail(letter)}
                          style={{
                            padding: '1.5rem',
                            background: 'white',
                            border: '2px solid var(--border-color)',
                            borderRadius: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--traditional-green)'
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                            e.currentTarget.style.transform = 'translateY(0)'
                          }}
                        >
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#999',
                            marginBottom: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'nowrap'
                          }}>
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                              flex: '0 1 auto'
                            }}>{new Date(letter.createdAt).toLocaleDateString('ko-KR')}</span>
                            {letter.reply && (
                              <span style={{
                                background: 'var(--traditional-green)',
                                color: 'white',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '1rem',
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                답장완료
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#333',
                            marginBottom: '0.5rem',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}>
                            {preview || '편지 내용 없음'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>아직 보낸 편지가 없습니다.</div>
                )}
              </div>
              
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--traditional-blue)' }}>대화 ({studentActivity?.chatSessions.length || 0}개)</h3>
                {studentActivity?.chatSessions.length ? (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                    gap: '1rem' 
                  }}>
                    {studentActivity.chatSessions.map((session) => {
                      const firstMessage = session.messages[0]?.content || ''
                      const preview = firstMessage.length > 50 
                        ? firstMessage.substring(0, 50) + '...' 
                        : firstMessage
                      const messageCount = session.messages.length
                      const lastMessageTime = session.messages[session.messages.length - 1]?.createdAt || session.createdAt
                      
                      return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedChatSession(session)}
                          style={{
                            padding: '1.5rem',
                            background: 'white',
                            border: '2px solid var(--border-color)',
                            borderRadius: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--traditional-blue)'
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                            e.currentTarget.style.transform = 'translateY(0)'
                          }}
                        >
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#999',
                            marginBottom: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'nowrap'
                          }}>
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                              flex: '0 1 auto'
                            }}>{new Date(session.createdAt).toLocaleDateString('ko-KR')}</span>
                            <span style={{
                              background: 'var(--traditional-blue)',
                              color: 'white',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              {messageCount}개
                            </span>
                          </div>
                          <div style={{
                            fontSize: '0.95rem',
                            color: '#333',
                            marginBottom: '0.5rem',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}>
                            {preview || '대화 내용 없음'}
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#999',
                            marginTop: '0.5rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            마지막: {new Date(lastMessageTime).toLocaleString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>아직 대화가 없습니다.</div>
                )}
              </div>
              
              <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ 
                  fontSize: '1.6rem', 
                  marginBottom: '1.2rem', 
                  color: 'var(--traditional-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: 800
                }}>
                  <span style={{ fontSize: '1.8rem' }}>🎯</span> 학습 결과 ({studentActivity?.learnResults.length || 0}개)
                </h3>
                {studentActivity?.learnResults.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[...studentActivity.learnResults]
                      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                      .map((result) => (
                      <div key={result.id} style={{ 
                        padding: '1.5rem', 
                        background: 'white', 
                        border: '1px solid #e0e0e0', 
                        borderRadius: '1.2rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '1rem'
                        }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' }}>세종대왕의 업적 학습 완료</div>
                          <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            {new Date(result.completedAt).toLocaleString('ko-KR')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                          {result.items.map((item, idx) => (
                            <span key={idx} style={{ 
                              padding: '0.5rem 1rem', 
                              background: '#fff9e6', 
                              color: '#d4a017',
                              border: '1px solid #ffeeba',
                              borderRadius: '2rem', 
                              fontSize: '0.95rem',
                              fontWeight: 700
                            }}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '3rem', 
                    textAlign: 'center', 
                    background: '#f8f9fa', 
                    borderRadius: '1.2rem',
                    color: '#999',
                    border: '1px dashed #ddd'
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
                    <p>아직 학습 결과가 없습니다.</p>
                  </div>
                )}
              </div>
              
              <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ 
                  fontSize: '1.6rem', 
                  marginBottom: '1.2rem', 
                  color: 'var(--traditional-red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: 800
                }}>
                  <span style={{ fontSize: '1.8rem' }}>⌨️</span> 타자 연습 결과 ({studentActivity?.typingResults.length || 0}개)
                </h3>
                {studentActivity?.typingResults.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    {[...studentActivity.typingResults]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((result) => (
                      <div key={result.id} style={{ 
                        padding: '1.8rem', 
                        background: 'white', 
                        border: '1px solid #e0e0e0', 
                        borderRadius: '1.2rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* 상단 띠 장식 */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'var(--traditional-red)',
                          opacity: 0.8
                        }}></div>

                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '1.5rem',
                          borderBottom: '1px solid #f0f0f0',
                          paddingBottom: '0.8rem'
                        }}>
                          <div style={{ fontSize: '1.1rem', color: '#1a1a1a', fontWeight: 700 }}>
                            {new Date(result.date).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div style={{ 
                            background: '#f8f9fa',
                            padding: '0.4rem 1rem',
                            borderRadius: '2rem',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#444',
                            border: '1px solid #eee'
                          }}>
                            {result.mode === 'classic' ? '🔤 전통' : result.mode === 'falling' ? '☁️ 떨어지는 글자' : '🏹 활 쏘기'}
                          </div>
                        </div>

                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(4, 1fr)', 
                          gap: '1rem',
                          textAlign: 'center'
                        }}>
                          <div style={{ background: '#f0f4ff', padding: '1rem', borderRadius: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', color: '#5c6bc0', marginBottom: '0.4rem', fontWeight: 600 }}>점수</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#283593' }}>{result.score}</div>
                          </div>
                          <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', color: '#43a047', marginBottom: '0.4rem', fontWeight: 600 }}>정답</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1b5e20' }}>{result.correct}</div>
                          </div>
                          <div style={{ background: '#fff1f1', padding: '1rem', borderRadius: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', color: '#e53935', marginBottom: '0.4rem', fontWeight: 600 }}>오답</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b71c1c' }}>{result.wrong}</div>
                          </div>
                          <div style={{ background: '#fff9e6', padding: '1rem', borderRadius: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', color: '#f57f17', marginBottom: '0.4rem', fontWeight: 600 }}>레벨</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e65100' }}>{result.level}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '3rem', 
                    textAlign: 'center', 
                    background: '#f8f9fa', 
                    borderRadius: '1.2rem',
                    color: '#999',
                    border: '1px dashed #ddd'
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⌨️</div>
                    <p>아직 타자 연습 결과가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                학생을 선택해주세요
              </div>
              <div style={{ fontSize: '0.95rem', color: '#999' }}>
                왼쪽 목록에서 학생을 선택하면 활동 결과를 확인할 수 있습니다.
              </div>
            </div>
          )}
        </div>
        
        {/* 대화 상세 보기 모달 */}
        {selectedChatSession && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '2rem'
            }}
            onClick={() => setSelectedChatSession(null)}
          >
            <div 
              style={{
                background: 'white',
                borderRadius: '1rem',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '2px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, var(--traditional-blue), var(--traditional-green))',
                color: 'white'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                    대화 상세 보기
                  </h3>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.3rem', opacity: 0.9 }}>
                    {new Date(selectedChatSession.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedChatSession(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '2.5rem',
                    height: '2.5rem',
                    fontSize: '1.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  }}
                >
                  ×
                </button>
              </div>
              
              {/* 모달 내용 */}
              <div style={{
                padding: '1.5rem',
                overflowY: 'auto',
                flex: 1
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedChatSession.messages.map((msg, idx) => (
                    <div 
                      key={msg.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: '#666',
                        marginBottom: '0.3rem'
                      }}>
                        {msg.role === 'user' ? '학생' : '세종대왕'}
                      </div>
                      <div style={{
                        padding: '1rem 1.2rem',
                        background: msg.role === 'user' ? '#e3f2fd' : '#e8f5e9',
                        borderRadius: '1rem',
                        maxWidth: '70%',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: msg.role === 'user' 
                          ? '1px solid #90caf9' 
                          : '1px solid #a5d6a7'
                      }}>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          lineHeight: '1.6',
                          fontSize: '0.95rem',
                          color: '#333'
                        }}>
                          {msg.content}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#999',
                          marginTop: '0.5rem',
                          textAlign: 'right'
                        }}>
                          {new Date(msg.createdAt).toLocaleString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 편지 상세 보기 모달 */}
        {selectedLetterDetail && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '2rem'
            }}
            onClick={() => setSelectedLetterDetail(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '1rem',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '2px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, var(--traditional-green), var(--traditional-yellow))',
                color: 'white'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                    편지 상세 보기
                  </h3>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.3rem', opacity: 0.9 }}>
                    {new Date(selectedLetterDetail.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLetterDetail(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '2.5rem',
                    height: '2.5rem',
                    fontSize: '1.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  }}
                >
                  ×
                </button>
              </div>

              {/* 모달 내용 */}
              <div style={{
                padding: '2rem',
                overflowY: 'auto',
                flex: 1
              }}>
                {/* 학생의 편지 */}
                <div style={{
                  marginBottom: selectedLetterDetail.reply ? '2rem' : 0
                }}>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--traditional-green)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>📝</span>
                    <span>학생의 편지</span>
                  </div>
                  <div style={{
                    padding: '1.5rem',
                    background: '#f8f9fa',
                    borderRadius: '0.8rem',
                    border: '2px solid var(--border-color)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.8',
                    fontSize: '1rem',
                    color: '#333',
                    minHeight: '150px'
                  }}>
                    {selectedLetterDetail.content}
                  </div>
                </div>

                {/* 세종대왕의 답장 */}
                {selectedLetterDetail.reply && (
                  <div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'var(--traditional-red)',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>✉️</span>
                      <span>세종대왕의 답장</span>
                    </div>
                    <div style={{
                      padding: '1.5rem',
                      background: '#fff9f0',
                      borderRadius: '0.8rem',
                      border: '2px solid var(--traditional-yellow)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.8',
                      fontSize: '1rem',
                      color: '#333',
                      minHeight: '150px'
                    }}>
                      {selectedLetterDetail.reply}
                    </div>
                  </div>
                )}

                {/* 답장이 없는 경우 */}
                {!selectedLetterDetail.reply && (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#999',
                    fontStyle: 'italic',
                    background: '#f8f9fa',
                    borderRadius: '0.8rem',
                    border: '2px dashed var(--border-color)',
                    marginTop: '2rem'
                  }}>
                    아직 세종대왕의 답장이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="sidebar-menu">
        <div className="user-info">
          <div className="user-avatar" style={{
            background: 'white',
            padding: 0,
            overflow: 'hidden'
          }}>
            <img
              src="/sejong-avata.png"
              alt="세종대왕"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>
          <div className="user-details">
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>세종대왕</span>
          </div>
        </div>
        <div style={{ height: '8px', display: 'flex', width: '100%', margin: '0 0 1.5rem 0' }}>
          <div style={{ flex: 1, background: 'var(--traditional-red)' }}></div>
          <div style={{ flex: 1, background: 'var(--traditional-blue)' }}></div>
          <div style={{ flex: 1, background: 'var(--traditional-yellow)' }}></div>
          <div style={{ flex: 1, background: 'var(--traditional-green)' }}></div>
        </div>
        <div className="mode-selector">
          <button
            className={`mode-button ${mode === 'book' ? 'active' : ''}`}
            onClick={() => handleModeChange('book')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>📖</span>
            그림책 읽기
          </button>
          <button
            className={`mode-button ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => handleModeChange('chat')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>💬</span>
            이야기해요
          </button>
          <button
            className={`mode-button ${mode === 'learn' ? 'active' : ''}`}
            onClick={() => handleModeChange('learn')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>🏆</span>
            하신 일들
          </button>
          <button
            className={`mode-button ${mode === 'decorate' ? 'active' : ''}`}
            onClick={() => handleModeChange('decorate')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>🎨</span>
            한글 꾸미기
          </button>
          <button
            className={`mode-button ${mode === 'word' ? 'active' : ''}`}
            onClick={() => handleModeChange('word')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>🔍</span>
            한글을 찾아서
          </button>
          <button
            className={`mode-button ${mode === 'letter' ? 'active' : ''}`}
            onClick={() => handleModeChange('letter')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>✉️</span>
            편지쓰기
          </button>
          <button
            className={`mode-button ${mode === 'inbox' ? 'active' : ''}`}
            onClick={() => handleModeChange('inbox')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>📮</span>
            편지함
          </button>
          <button
            className={`mode-button ${mode === 'typing' ? 'active' : ''}`}
            onClick={() => handleModeChange('typing')}
          >
            <span style={{ fontSize: '1.3rem', marginRight: '0.5rem' }}>⌨️</span>
            타자연습
          </button>
        </div>
        <button 
          onClick={() => handleRoleSelect('teacher')}
          style={{
            width: '100%',
            padding: '0.8rem',
            marginBottom: '0.5rem',
            background: 'var(--traditional-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
            e.currentTarget.style.transform = 'scale(1.02)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          👨‍🏫 교사 화면
        </button>
        {student && (
          <button
            onClick={async () => {
              try {
                await saveTestPing(student.uid)
                alert('Firebase에 테스트 데이터가 저장되었습니다. (컬렉션: testPings)')
              } catch (e) {
                alert('테스트 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.')
              }
            }}
            style={{
              width: '100%',
              padding: '0.6rem',
              marginBottom: '0.5rem',
              background: '#f5f5f5',
              color: '#333',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            🔍 Firebase 테스트 저장
          </button>
        )}
        <button onClick={handleLogout} className="logout-btn-small">
          로그아웃
        </button>
      </div>

      <div className="chat-container">
        {apiStatus !== 'checking' && (
          <div className={`api-status-banner ${apiStatus === 'online' ? 'api-status-online' : 'api-status-offline'}`}>
            <div className="api-status-banner-content">
              <span className="api-status-indicator"></span>
              <span className="api-status-text">
                {apiStatus === 'online'
                  ? 'API 서버가 정상적으로 작동 중입니다.'
                  : 'API 서버에 연결할 수 없습니다. 오프라인 모드로 작동합니다.'}
              </span>
            </div>
          </div>
        )}
        
        {mode === 'chat' && (
          <>
            {/* 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-color)',
              padding: '1rem 1.5rem',
              background: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--border-color)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  <img
                    src="/sejong-avata.png"
                    alt="세종대왕"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#0d121b' }}>
                    세종대왕님
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      background: submitting ? '#E8B856' : '#4A7060',
                      borderRadius: '50%',
                      animation: submitting ? 'pulse 2s ease-in-out infinite' : 'none'
                    }}></span>
                    <span style={{ fontSize: '1rem', color: '#666', fontWeight: 600 }}>
                      {submitting ? '답변 작성 중...' : '온라인'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {messages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: '#999',
                  fontSize: '1.2rem'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                  <p style={{ margin: 0, fontWeight: 600 }}>세종대왕과 대화를 시작해보세요!</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isUser = m.role === 'user'
                  const showAvatar = idx === 0 || messages[idx - 1].role !== m.role

                  return (
                    <div key={m.id} style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '0.75rem',
                      maxWidth: '960px',
                      margin: '0 auto',
                      width: '100%',
                      flexDirection: isUser ? 'row-reverse' : 'row'
                    }}>
                      {/* 아바타 */}
                      {showAvatar ? (
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: isUser ? 'var(--traditional-blue)' : 'white',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          flexShrink: 0,
                          border: '2px solid white',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                          alignSelf: 'flex-start',
                          marginTop: '0.25rem',
                          overflow: 'hidden'
                        }}>
                          {isUser ? (
                            '나'
                          ) : (
                            <img
                              src="/sejong-avata.png"
                              alt="세종대왕"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div style={{ width: '40px', flexShrink: 0 }}></div>
                      )}

                      {/* 메시지 버블 */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: 'calc(100% - 56px)'
                      }}>
                        {showAvatar && (
                          <p style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            color: '#666',
                            paddingLeft: isUser ? 0 : '0.25rem',
                            paddingRight: isUser ? '0.25rem' : 0
                          }}>
                            {isUser ? '나' : '세종대왕'}
                          </p>
                        )}
                        <div style={{
                          padding: '1rem 1.25rem',
                          background: isUser
                            ? 'var(--traditional-blue)'
                            : 'white',
                          color: isUser ? 'white' : '#0d121b',
                          borderRadius: '1.25rem',
                          borderTopLeftRadius: !isUser && showAvatar ? '0.25rem' : '1.25rem',
                          borderTopRightRadius: isUser && showAvatar ? '0.25rem' : '1.25rem',
                          fontSize: '1.5rem',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          boxShadow: isUser
                            ? '0 2px 8px rgba(40, 77, 117, 0.2)'
                            : '0 1px 3px rgba(0,0,0,0.08)',
                          border: isUser ? 'none' : '1px solid var(--border-color)',
                          maxWidth: '100%'
                        }}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {error && (
                <div style={{
                  padding: '1rem',
                  background: '#ffebee',
                  color: 'var(--traditional-red)',
                  borderRadius: '0.75rem',
                  margin: '1rem auto',
                  maxWidth: '960px',
                  width: '100%',
                  border: '1px solid #ffcdd2',
                  fontSize: '0.95rem'
                }}>
                  {error}
                </div>
              )}
            </div>

            {/* 입력 영역 */}
            <div style={{
              background: 'white',
              borderTop: '1px solid var(--border-color)',
              padding: '1rem 1.5rem 1.5rem',
              position: 'sticky',
              bottom: 0,
              zIndex: 20,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.02)'
            }}>
              <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
                <form onSubmit={handleSubmit} style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '0.75rem',
                  background: '#f8f9fc',
                  borderRadius: '1.5rem',
                  padding: '0.5rem',
                  border: '2px solid var(--border-color)',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  if (e.currentTarget.contains(e.target)) {
                    e.currentTarget.style.borderColor = 'var(--traditional-green)'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(74, 112, 96, 0.1)'
                  }
                }}
                onBlur={(e) => {
                  if (e.currentTarget.contains(e.target)) {
                    e.currentTarget.style.borderColor = 'var(--border-color)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e as any)
                      }
                    }}
                    placeholder="세종대왕님께 하고 싶은 말을 적어보세요..."
                    disabled={submitting}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '1.6rem',
                      padding: '1.25rem 1rem',
                      resize: 'none',
                      minHeight: '80px',
                      maxHeight: '200px',
                      fontFamily: 'inherit',
                      color: '#0d121b',
                      fontWeight: 500
                    }}
                    rows={1}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !input.trim()}
                    style={{
                      background: submitting || !input.trim() ? '#ccc' : 'var(--traditional-green)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '60px',
                      height: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: submitting || !input.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: submitting || !input.trim() ? 'none' : '0 4px 12px rgba(74, 112, 96, 0.3)',
                      fontSize: '2rem',
                      flexShrink: 0,
                      marginBottom: '0.5rem',
                      marginRight: '0.5rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!submitting && input.trim()) {
                        e.currentTarget.style.transform = 'scale(1.05)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(74, 112, 96, 0.4)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = submitting || !input.trim() ? 'none' : '0 4px 12px rgba(74, 112, 96, 0.3)'
                    }}
                    onMouseDown={(e) => {
                      if (!submitting && input.trim()) {
                        e.currentTarget.style.transform = 'scale(0.95)'
                      }
                    }}
                    onMouseUp={(e) => {
                      if (!submitting && input.trim()) {
                        e.currentTarget.style.transform = 'scale(1.05)'
                      }
                    }}
                  >
                    {submitting ? '...' : '➤'}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {mode === 'letter' && (
          <div className="letter-mode">
            <div className="chat-header">
              <h1>세종대왕님께 서신 보내기</h1>
            </div>
            <div className="letter-container">
              <div className="letter-scroll-wrapper">
                <div className="letter-scroll-rod letter-scroll-rod-top"></div>
                <div className="letter-scroll-content">
                  <div className="letter-scroll-paper">
                    <div className="letter-scroll-header">
                      <div className="letter-scroll-recipient">받는 사람: 세종대왕님</div>
                    </div>
                    <div className="letter-scroll-date-header">
                      {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="letter-scroll-body">
                      <textarea
                        className="letter-textarea"
                        value={letterContent}
                        onChange={(e) => setLetterContent(e.target.value)}
                        placeholder="존경하는 마음을 담아 편지를 써보세요..."
                        disabled={sendingLetter}
                      />
                    </div>
                    <div className="letter-scroll-footer">
                      <button 
                        className="save-button" 
                        onClick={handleSendLetter}
                        disabled={!letterContent.trim() || sendingLetter}
                      >
                        {sendingLetter ? '보내는 중...' : '편지보내기'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="letter-scroll-rod letter-scroll-rod-bottom"></div>
              </div>
              
              {currentLetter && (
                <div style={{ marginTop: '2rem' }}>
                  <div className="letter-scroll-wrapper">
                    <div className="letter-scroll-rod letter-scroll-rod-top"></div>
                    <div className="letter-scroll-content">
                      <div className="letter-scroll-paper">
                        <div className="letter-scroll-header">
                          <div className="letter-scroll-recipient">세종대왕님께서 보내신 답장</div>
                        </div>
                        <div className="letter-scroll-date-header">
                          {new Date(currentLetter.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="letter-scroll-body">
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '1.1rem' }}>
                            {currentLetter.reply}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="letter-scroll-rod letter-scroll-rod-bottom"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'inbox' && (
          <div className="inbox-mode">
            <div className="chat-header">
              <h1>편지함</h1>
            </div>
            <div className="letters-list">
              {savedLetters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  아직 받은 편지가 없습니다.
                </div>
              ) : (
                savedLetters.map((l) => (
                  <div
                    key={l.id}
                    className="letter-item"
                    onClick={() => setSelectedLetterDetail(l)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="letter-date">{new Date(l.createdAt).toLocaleDateString('ko-KR')}</div>
                    <div className="letter-content" style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {l.content}
                    </div>
                    {l.reply && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--traditional-red)', marginTop: '0.5rem' }}>
                        💌 답장이 도착했어요!
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 편지 상세보기 모달 */}
            {selectedLetterDetail && (
              <div
                className="letter-modal-overlay"
                onClick={() => setSelectedLetterDetail(null)}
              >
                <div
                  className="letter-modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="letter-modal-close"
                    onClick={() => setSelectedLetterDetail(null)}
                  >
                    ✕
                  </button>

                  <div className="letter-modal-scroll">
                    <div className="letter-scroll-rod letter-scroll-rod-top"></div>
                    <div className="letter-scroll-content">
                      <div className="letter-scroll-paper">
                        <div className="letter-scroll-corner letter-scroll-corner-tl"></div>
                        <div className="letter-scroll-corner letter-scroll-corner-tr"></div>
                        <div className="letter-scroll-corner letter-scroll-corner-bl"></div>
                        <div className="letter-scroll-corner letter-scroll-corner-br"></div>

                        <div style={{ marginBottom: '2rem' }}>
                          <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '1rem' }}>
                            받는 사람: 세종대왕님
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#999' }}>
                            {new Date(selectedLetterDetail.createdAt).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>

                        <div className="scroll-text" style={{ whiteSpace: 'pre-wrap', marginBottom: '2rem' }}>
                          {selectedLetterDetail.content}
                        </div>

                        {selectedLetterDetail.reply && (
                          <div style={{
                            marginTop: '3rem',
                            paddingTop: '2rem',
                            borderTop: '2px dashed var(--border-color)'
                          }}>
                            <div style={{
                              fontSize: '1.1rem',
                              fontWeight: 800,
                              color: 'var(--traditional-red)',
                              marginBottom: '1.5rem'
                            }}>
                              💌 세종대왕님의 답장
                            </div>
                            <div className="scroll-text" style={{ whiteSpace: 'pre-wrap' }}>
                              {selectedLetterDetail.reply}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="letter-scroll-rod letter-scroll-rod-bottom"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'learn' && (
          <div style={{
            flex: 1,
            overflow: 'auto',
            background: '#f6f8fc',
            padding: '1rem'
          }}>
            <div style={{
              maxWidth: '1000px',
              margin: '0 auto'
            }}>
              {/* 헤더 섹션 */}
              <div style={{
                background: 'white',
                borderRadius: '1.2rem',
                padding: '1.5rem',
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                textAlign: 'center'
              }}>
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  marginBottom: '0.4rem',
                  color: '#1976d2'
                }}>
                  🎯 세종대왕의 하신 일 알아보기
                </h1>
                <p style={{
                  fontSize: '1.2rem',
                  color: '#666',
                  lineHeight: 1.4
                }}>
                  각 이미지에 맞는 이름과 설명을 드래그하여 연결해보세요!
                </p>
              </div>

              {/* 드래그&드롭 게임 섹션 */}
              <div style={{
                background: 'white',
                borderRadius: '1.2rem',
                padding: '1.5rem 2rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                marginBottom: '1rem'
              }}>
                {/* 이미지 카드들 (드롭 존) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  {allLearnItems.map((item) => {
                    const bgColors: Record<string, string> = {
                      '1': '#fff9e6',
                      '2': '#e3f2fd',
                      '3': '#f3e5f5'
                    }
                    const droppedName = _droppedItems[item.id]?.name;
                    const droppedDesc = _droppedItems[item.id]?.description;
                    
                    const isNameCorrect = droppedName?.sourceId === item.id;
                    const isDescCorrect = droppedDesc?.sourceId === item.id;

                    return (
                      <div
                        key={item.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const data = e.dataTransfer.getData('text/plain')
                          try {
                            const draggedData = JSON.parse(data)
                            // 이제 ID 체크 없이 무엇이든 드롭 허용
                            setDroppedItems(prev => ({
                              ...prev,
                              [item.id]: { 
                                ...prev[item.id],
                                [draggedData.type]: { text: draggedData.text, sourceId: draggedData.id }
                              }
                            }))
                            // 드롭하면 피드백 초기화 (다시 확인하도록)
                            setShowLearnFeedback(false)
                          } catch (err) {
                            console.error('Drop error:', err)
                          }
                        }}
                        style={{
                          background: 'white',
                          border: showLearnFeedback 
                            ? (isNameCorrect && isDescCorrect ? '3px solid #4caf50' : '3px solid #f44336')
                            : '2px dashed #ddd',
                          borderRadius: '1.2rem',
                          padding: '1.2rem',
                          textAlign: 'center',
                          transition: 'all 0.3s',
                          minHeight: '300px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: '0.8rem',
                          position: 'relative'
                        }}
                      >
                        {/* 이미지 */}
                        <div style={{
                          width: '120px',
                          height: '120px',
                          background: bgColors[item.id] || '#f5f5f5',
                          borderRadius: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}>
                          <img
                            src={item.icon}
                            alt="업적"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        </div>

                        {/* 이름 드롭 영역 */}
                        <div style={{
                          width: '100%',
                          minHeight: '50px',
                          background: droppedName 
                            ? (showLearnFeedback ? (isNameCorrect ? '#e8f5e9' : '#ffebee') : '#f0f4ff') 
                            : '#f5f5f5',
                          borderRadius: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: droppedName 
                            ? (showLearnFeedback ? `2px solid ${isNameCorrect ? '#4caf50' : '#f44336'}` : '2px solid #5c6bc0') 
                            : '2px dashed #ccc',
                          padding: '0.4rem',
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          color: droppedName 
                            ? (showLearnFeedback ? (isNameCorrect ? '#2e7d32' : '#c62828') : '#283593') 
                            : '#999',
                          cursor: droppedName ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                          // 클릭 시 항목 제거
                          if (droppedName) {
                            setDroppedItems(prev => {
                              const next = { ...prev }
                              const slot = { ...next[item.id] }
                              delete slot.name
                              next[item.id] = slot
                              return next
                            })
                            setShowLearnFeedback(false)
                          }
                        }}>
                          {droppedName ? (showLearnFeedback ? (isNameCorrect ? `✓ ${droppedName.text}` : `✕ ${droppedName.text}`) : droppedName.text) : '이름 놓기'}
                        </div>

                        {/* 설명 드롭 영역 */}
                        <div style={{
                          width: '100%',
                          minHeight: '70px',
                          background: droppedDesc 
                            ? (showLearnFeedback ? (isDescCorrect ? '#e8f5e9' : '#ffebee') : '#f0f4ff') 
                            : '#f5f5f5',
                          borderRadius: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: droppedDesc 
                            ? (showLearnFeedback ? `2px solid ${isDescCorrect ? '#4caf50' : '#f44336'}` : '2px solid #5c6bc0') 
                            : '2px dashed #ccc',
                          padding: '0.6rem',
                          fontSize: '1rem',
                          lineHeight: 1.3,
                          color: droppedDesc 
                            ? (showLearnFeedback ? (isDescCorrect ? '#555' : '#c62828') : '#444') 
                            : '#999',
                          cursor: droppedDesc ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                          // 클릭 시 항목 제거
                          if (droppedDesc) {
                            setDroppedItems(prev => {
                              const next = { ...prev }
                              const slot = { ...next[item.id] }
                              delete slot.description
                              next[item.id] = slot
                              return next
                            })
                            setShowLearnFeedback(false)
                          }
                        }}>
                          {droppedDesc ? (showLearnFeedback ? (isDescCorrect ? droppedDesc.text : `✕ ${droppedDesc.text}`) : droppedDesc.text) : '설명 놓기'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 구분선 */}
                <div style={{
                  height: '1px',
                  background: '#eee',
                  margin: '1rem 0'
                }}></div>

                {/* 드래그 가능한 항목들 */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#333',
                    marginBottom: '0.3rem'
                  }}>
                    아래 카드를 드래그하여 위 이미지와 맞춰보세요
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: '#888' }}>
                    잘못 놓았다면 카드를 클릭해서 뺄 수 있어요!
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '0.8rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginBottom: '1.5rem'
                }}>
                  {_shuffledDragItems
                    .filter(dragItem => {
                      // 현재 보드에 이미 올라가 있는 텍스트는 제외
                      return !Object.values(_droppedItems).some(slot => 
                        (dragItem.type === 'name' && slot.name?.text === dragItem.text) ||
                        (dragItem.type === 'description' && slot.description?.text === dragItem.text)
                      )
                    })
                    .map((item, idx) => (
                      <div
                        key={`${item.id}-${item.type}-${idx}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify(item))
                        }}
                        style={{
                          background: item.type === 'name' 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
                          color: 'white',
                          padding: '0.8rem 1.2rem',
                          borderRadius: '0.8rem',
                          cursor: 'grab',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s',
                          width: item.type === 'name' ? '150px' : '240px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        <div style={{
                          fontSize: item.type === 'name' ? '1.2rem' : '1rem',
                          fontWeight: item.type === 'name' ? 700 : 500,
                          lineHeight: 1.3
                        }}>
                          {item.text}
                        </div>
                      </div>
                    ))}
                </div>

                {/* 정답 확인 버튼 */}
                <div style={{ textAlign: 'center' }}>
                  {Object.values(_droppedItems).some(d => d.name || d.description) && !learnSaved && (
                    <button
                      onClick={() => setShowLearnFeedback(true)}
                      style={{
                        background: 'var(--traditional-green)',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        borderRadius: '0.8rem',
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(74, 112, 96, 0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      정답 확인하기
                    </button>
                  )}
                </div>
              </div>

              {/* 완료 메시지 */}
              {allLearnItems.length > 0 && allLearnItems.every(item => 
                _droppedItems[item.id]?.name?.sourceId === item.id && 
                _droppedItems[item.id]?.description?.sourceId === item.id
              ) && showLearnFeedback && (
                <div style={{
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  borderRadius: '1.2rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'white',
                  marginBottom: '1rem',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.2)'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    marginBottom: '0.4rem'
                  }}>
                    축하합니다!
                  </h2>
                  <p style={{
                    fontSize: '1rem',
                    marginBottom: '1rem'
                  }}>
                    세종대왕의 업적을 모두 알아보았어요!
                  </p>
                  <button
                    onClick={() => {
                      setDroppedItems({})
                      setLearnSaved(false)
                      setShowLearnFeedback(false)
                    }}
                    style={{
                      background: 'white',
                      color: '#4caf50',
                      border: 'none',
                      padding: '0.6rem 1.5rem',
                      borderRadius: '0.6rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    다시 해보기
                  </button>
                </div>
              )}

              {/* 푸터 */}
              <div style={{
                textAlign: 'center',
                padding: '1rem 0',
                fontSize: '0.8rem',
                color: '#999'
              }}>
                © 2024 세종대왕 프로젝트. 학교에서 즐기는 한글 교육 프로그램
              </div>
            </div>
          </div>
        )}

        {mode === 'decorate' && (
          <div className="decorate-mode">
            <div className="chat-header">
              <h1>글자 꾸미기</h1>
            </div>
            <div className="decorate-container">
              <div className="decorate-main-layout">
                <div className="decorate-canvas-wrapper">
                  {selectedLetter ? (
                    <canvas
                      ref={decorateCanvasRef}
                      className="decorate-canvas"
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      onTouchStart={handleCanvasTouchStart}
                      onTouchMove={handleCanvasTouchMove}
                      onTouchEnd={handleCanvasTouchEnd}
                    />
                  ) : (
                    <div className="decorate-canvas-placeholder">
                      오른쪽에서 한글 한 글자를 입력해주세요.
                    </div>
                  )}
                </div>
                
                <div className="decorate-controls-panel">
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">글자</label>
                    <input
                      type="text"
                      className="letter-input"
                      maxLength={1}
                      value={selectedLetter}
                      onChange={(e) => {
                        const val = e.target.value
                        // 한 글자만 허용 (조합 중인 문자도 일단 허용)
                        if (val.length <= 1) {
                          setSelectedLetter(val)
                        } else {
                          // 여러 글자가 입력된 경우 첫 번째 글자만
                          setSelectedLetter(val[0])
                          e.currentTarget.value = val[0]
                        }
                      }}
                      onCompositionEnd={(e) => {
                        // 한글 조합 완료 후 검증
                        const val = e.currentTarget.value
                        if (val === '') {
                          setSelectedLetter('')
                        } else if (val.length === 1) {
                          // 한글 완성형이면 허용
                          if (/^[가-힣]$/.test(val)) {
                            setSelectedLetter(val)
                          } else {
                            // 한글이 아니면 빈 문자열로
                            setSelectedLetter('')
                            e.currentTarget.value = ''
                          }
                        } else {
                          // 여러 글자가 입력된 경우 첫 번째 한글만 추출
                          const koreanMatch = val.match(/[가-힣]/)
                          if (koreanMatch) {
                            setSelectedLetter(koreanMatch[0])
                            e.currentTarget.value = koreanMatch[0]
                          } else {
                            setSelectedLetter('')
                            e.currentTarget.value = ''
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Backspace나 Delete 키는 허용
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          setSelectedLetter('')
                        }
                      }}
                      placeholder="가"
                      autoFocus={mode === 'decorate'}
                    />
                  </div>
                  
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">메인 색상 (단청)</label>
                    <div className="decorate-color-swatches">
                      <button
                        className={`color-swatch ${fillColor === '#C93C3C' ? 'active' : ''}`}
                        style={{ background: '#C93C3C' }}
                        onClick={() => setFillColor('#C93C3C')}
                        title="빨강"
                      />
                      <button
                        className={`color-swatch ${fillColor === '#4A7060' ? 'active' : ''}`}
                        style={{ background: '#4A7060' }}
                        onClick={() => setFillColor('#4A7060')}
                        title="녹색"
                      />
                      <button
                        className={`color-swatch ${fillColor === '#284D75' ? 'active' : ''}`}
                        style={{ background: '#284D75' }}
                        onClick={() => setFillColor('#284D75')}
                        title="파랑"
                      />
                      <button
                        className={`color-swatch ${fillColor === '#E8B856' ? 'active' : ''}`}
                        style={{ background: '#E8B856' }}
                        onClick={() => setFillColor('#E8B856')}
                        title="노랑"
                      />
                      <button
                        className={`color-swatch ${fillColor === '#000000' ? 'active' : ''}`}
                        style={{ background: '#000000' }}
                        onClick={() => setFillColor('#000000')}
                        title="검정"
                      />
                    </div>
                  </div>
                  
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">테두리 색상</label>
                    <div className="decorate-color-swatches">
                      <button
                        className={`color-swatch ${strokeColor === '#C93C3C' ? 'active' : ''}`}
                        style={{ background: '#C93C3C' }}
                        onClick={() => setStrokeColor('#C93C3C')}
                        title="빨강"
                      />
                      <button
                        className={`color-swatch ${strokeColor === '#4A7060' ? 'active' : ''}`}
                        style={{ background: '#4A7060' }}
                        onClick={() => setStrokeColor('#4A7060')}
                        title="녹색"
                      />
                      <button
                        className={`color-swatch ${strokeColor === '#284D75' ? 'active' : ''}`}
                        style={{ background: '#284D75' }}
                        onClick={() => setStrokeColor('#284D75')}
                        title="파랑"
                      />
                      <button
                        className={`color-swatch ${strokeColor === '#E8B856' ? 'active' : ''}`}
                        style={{ background: '#E8B856' }}
                        onClick={() => setStrokeColor('#E8B856')}
                        title="노랑"
                      />
                      <button
                        className={`color-swatch ${strokeColor === '#F4F0E6' ? 'active' : ''}`}
                        style={{ background: '#F4F0E6', border: '1px solid #ccc' }}
                        onClick={() => setStrokeColor('#F4F0E6')}
                        title="베이지"
                      />
                    </div>
                  </div>
                  
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">테두리 굵기: {strokeWidth}px</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="decorate-slider"
                    />
                  </div>
                  
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">패턴</label>
                    <div className="decorate-pattern-buttons">
                      <button
                        className={`pattern-btn ${fillColor && !fillColor.includes('url') ? 'active' : ''}`}
                        onClick={() => setFillColor(fillColor)}
                      >
                        단색
                      </button>
                      <button
                        className="pattern-btn"
                        onClick={() => {
                          // 패턴 기능은 나중에 구현
                        }}
                      >
                        점
                      </button>
                      <button
                        className="pattern-btn"
                        onClick={() => {
                          // 패턴 기능은 나중에 구현
                        }}
                      >
                        선
                      </button>
                    </div>
                  </div>
                  
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">서체</label>
                    <select
                      className="decorate-font-select"
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value as any)}
                    >
                      <option value="Gungsuh">궁서체</option>
                      <option value="Nanum Gothic">나눔고딕</option>
                      <option value="Nanum Pen Script">나눔펜</option>
                      <option value="Jua">둥근모</option>
                    </select>
                  </div>
                  
                  <div className="decorate-control-group">
                    <label className="decorate-control-label">붓 크기: {brushSize}</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="decorate-slider"
                    />
                  </div>
                  
                  <div className="decorate-actions">
                    <button className="decorate-clear-btn" onClick={handleClearCanvas}>
                      지우기
                    </button>
                    <button className="decorate-save-btn" onClick={handleSaveDecoratedLetter}>
                      저장하기
                    </button>
                  </div>
                </div>
              </div>
              
              {decoratedLetters.length > 0 && (
                <div className="decorate-gallery">
                  <h3>저장된 작품</h3>
                  <div className="decorated-letters-grid">
                    {decoratedLetters.map((item) => (
                      <div key={item.id} className="decorated-letter-item">
                        <img src={item.dataUrl} alt={item.letter} />
                        <div className="decorated-letter-info">
                          <div className="decorated-letter-text">{item.letter}</div>
                          <div className="decorated-letter-date">
                            {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                          </div>
                          <div className="decorated-letter-actions">
                            <button 
                              className="decorated-letter-download-btn"
                              onClick={() => handleDownloadDecoratedLetter(item)}
                              title="다운로드"
                            >
                              📥 다운로드
                            </button>
                            <button 
                              className="decorated-letter-delete-btn"
                              onClick={() => handleDeleteDecoratedLetter(item.id)}
                              title="삭제"
                            >
                              🗑️ 삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'typing' && (
          <div className="typing-mode">
            <div className="chat-header">
              <h1>타자연습</h1>
            </div>
            <div className="typing-container">
              <div className="typing-controls">
                <div className="typing-mode-selector">
                  <button
                    className={`typing-mode-btn ${typingMode === 'letter' ? 'active' : ''}`}
                    onClick={() => {
                      setTypingMode('letter')
                      resetTyping()
                    }}
                  >
                    한글자 연습
                  </button>
                  <button
                    className={`typing-mode-btn ${typingMode === 'word' ? 'active' : ''}`}
                    onClick={() => {
                      setTypingMode('word')
                      resetTyping()
                    }}
                  >
                    단어 연습
                  </button>
                </div>
                
                <div className="game-style-selector">
                  <h3 className="game-style-title">게임 모드 선택</h3>
                  <div className="game-style-buttons">
                    <button
                      className={`game-style-btn ${gameStyle === 'classic' ? 'active' : ''}`}
                      onClick={() => {
                        setGameStyle('classic')
                        resetTyping()
                      }}
                    >
                      📝 전통
                    </button>
                    <button
                      className={`game-style-btn ${gameStyle === 'falling' ? 'active' : ''}`}
                      onClick={() => {
                        setGameStyle('falling')
                        resetTyping()
                      }}
                    >
                      🌧️ 떨어지는 글자
                    </button>
                    <button
                      className={`game-style-btn ${gameStyle === 'archery' ? 'active' : ''}`}
                      onClick={() => {
                        setGameStyle('archery')
                        resetTyping()
                      }}
                    >
                      🏹 활 쏘기
                    </button>
                  </div>
                </div>
                <div className="typing-game-header">
                  <div className="typing-level-display">
                    <span className="typing-level-label">레벨</span>
                    <span className="typing-level-value">{typingLevel}</span>
                  </div>
                  <div className="typing-combo-display">
                    {typingCombo > 0 && (
                      <div className="typing-combo-badge">
                        {typingCombo}연속 정답! 🔥
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="typing-progress-section">
                  <div className="typing-progress-label">
                    목표: {typingGoal}점 ({typingScore}/{typingGoal})
                  </div>
                  <div className="typing-progress-bar">
                    <div 
                      className="typing-progress-fill"
                      style={{ width: `${typingProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="typing-stats">
                  <div className="typing-stat-item">
                    <span className="typing-stat-label">점수:</span>
                    <span className="typing-stat-value">{typingScore}</span>
                  </div>
                  <div className="typing-stat-item">
                    <span className="typing-stat-label">정답:</span>
                    <span className="typing-stat-value correct">{typingCorrect}</span>
                  </div>
                  <div className="typing-stat-item">
                    <span className="typing-stat-label">오답:</span>
                    <span className="typing-stat-value wrong">{typingWrong}</span>
                  </div>
                  <div className="typing-stat-item">
                    <span className="typing-stat-label">최대 연속:</span>
                    <span className="typing-stat-value combo">{typingMaxCombo}</span>
                  </div>
                  <div className="typing-stat-item">
                    <span className="typing-stat-label">시간:</span>
                    <span className="typing-stat-value">{Math.floor(typingTime / 60)}:{(typingTime % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
              
              <div className="typing-game-area" ref={gameAreaRef}>
                {typingFeedback && (
                  <div className={`typing-feedback typing-feedback-${typingFeedbackType}`}>
                    {typingFeedback}
                  </div>
                )}
                
                {/* 떨어지는 글자 게임 */}
                {gameStyle === 'falling' && (
                  <div className="falling-game-container">
                    <div className="falling-game-background">
                      {fallingLetters.map(item => (
                        <div
                          key={item.id}
                          className="falling-letter"
                          style={{
                            left: `${item.x}%`,
                            top: `${item.y}%`
                          }}
                        >
                          {item.letter}
                        </div>
                      ))}
                    </div>
                    <div className="falling-game-instruction">
                      <p>하늘에서 떨어지는 글자를 입력하세요! ⬇️</p>
                    </div>
                  </div>
                )}
                
                {/* 활 쏘기 게임 */}
                {gameStyle === 'archery' && (
                  <div className="archery-game-container">
                    <div className="archery-game-background">
                      {/* 가마 */}
                      <div 
                        className="palanquin"
                        style={{ left: `${palanquinPosition}%` }}
                      >
                        🏯
                      </div>
                      
                      {/* 타겟 글자들 */}
                      {archeryTargets.map(target => (
                        <div
                          key={target.id}
                          className="archery-target"
                          style={{
                            left: `${target.x}%`,
                            top: `${target.y}%`
                          }}
                        >
                          <div className="target-letter">{target.letter}</div>
                          <div className="target-ring"></div>
                        </div>
                      ))}
                      
                      {/* 화살들 */}
                      {arrows.map(arrow => (
                        <div
                          key={arrow.id}
                          className="arrow"
                          style={{
                            left: `${arrow.x}%`,
                            top: `${arrow.y}%`
                          }}
                        >
                          ➶
                        </div>
                      ))}
                    </div>
                    <div className="archery-game-instruction">
                      <p>가마를 타고 가며 나타나는 글자를 입력해 활을 쏘세요! 🏹</p>
                    </div>
                  </div>
                )}
                
                {/* 전통 모드 */}
                {gameStyle === 'classic' && (
                  <div className="typing-target-display">
                    {currentTarget ? (
                      <div className={`typing-target-text ${isTypingActive ? 'typing-active' : ''}`}>
                        {currentTarget}
                      </div>
                    ) : (
                      <div className="typing-target-placeholder">
                        {typingMode === 'letter' ? '한글자를 입력하세요' : '단어를 입력하세요'}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="typing-input-area">
                  <input
                    ref={typingInputRef}
                    type="text"
                    className="typing-input"
                    value={typingInput}
                    onChange={(e) => handleTypingInput(e.target.value)}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    onKeyDown={(e) => {
                      // Enter 키로 시작
                      if (!isTypingActive && e.key === 'Enter' && typingInput.length === 0) {
                        e.preventDefault()
                        startTyping()
                      }
                    }}
                    placeholder={
                      gameStyle === 'falling' 
                        ? '떨어지는 글자를 입력하세요' 
                        : gameStyle === 'archery'
                        ? '타겟 글자를 입력해 활을 쏘세요'
                        : typingMode === 'letter' 
                        ? '한글자를 입력하세요' 
                        : '단어를 입력하세요'
                    }
                    autoFocus
                  />
                </div>
                
                <div className="typing-actions">
                  {!isTypingActive ? (
                    <button className="typing-start-btn" onClick={startTyping}>
                      시작하기
                    </button>
                  ) : (
                    <button className="typing-stop-btn" onClick={stopTyping}>
                      일시정지
                    </button>
                  )}
                  <button className="typing-reset-btn" onClick={resetTyping}>
                    다시시작
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'word' && (
          <div className="word-mode">
            <div className="chat-header">
              <h1>한글을 찾아서</h1>
              <p>순 우리말을 배우고 문장을 만들어보세요</p>
            </div>

            {!selectedWord ? (
              <div className="word-cards-container">
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#2c3e50', fontSize: '2rem' }}>
                  낱말을 선택하여 문장을 만들어 봅시다
                </h2>
                <div className="word-cards">
                  {displayedWords.map((item, index) => (
                    <div
                      key={index}
                      className="word-card"
                      onClick={() => setSelectedWord(item)}
                    >
                      <div className="word-card-word">{item.word}</div>
                      <div className="word-card-meaning">{item.meaning}</div>
                    </div>
                  ))}
                </div>
                <button
                  className="word-refresh-btn"
                  onClick={() => {
                    const shuffled = [...koreanWords].sort(() => Math.random() - 0.5)
                    setDisplayedWords(shuffled.slice(0, 5))
                  }}
                >
                  다른 낱말 보기 🔄
                </button>
              </div>
            ) : (
              <div className="word-sentence-container">
                <div className="selected-word-display">
                  <h2>선택한 낱말</h2>
                  <div className="word-card selected">
                    <div className="word-card-word">{selectedWord.word}</div>
                    <div className="word-card-meaning">{selectedWord.meaning}</div>
                  </div>
                  <button
                    className="word-back-btn"
                    onClick={() => {
                      setSelectedWord(null)
                      setUserSentence('')
                      setWordFeedback(null)
                    }}
                  >
                    ← 다른 낱말 선택
                  </button>
                </div>

                <div className="sentence-form">
                  <h3>'{selectedWord.word}'를 사용하여 문장을 만들어보세요</h3>
                  <textarea
                    className="sentence-input"
                    value={userSentence}
                    onChange={(e) => setUserSentence(e.target.value)}
                    placeholder={`예: ${selectedWord.word}는 정말 아름다운 말이에요.`}
                    rows={4}
                    disabled={submittingWord}
                    onCompositionStart={() => {}}
                    onCompositionEnd={(e: any) => setUserSentence(e.target.value)}
                    style={{ color: '#000', WebkitTextFillColor: '#000', opacity: 1 }}
                  />
                  <button
                    className="sentence-submit-btn"
                    onClick={async () => {
                      if (!userSentence.trim()) {
                        alert('문장을 입력해주세요!')
                        return
                      }

                      setSubmittingWord(true)
                      setWordFeedback(null)

                      try {
                        const response = await fetch('/.netlify/functions/chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            messages: [
                              {
                                role: 'system',
                                content: `당신은 세종대왕입니다. 학생은 초등학교 2학년입니다. 학생이 순 우리말 '${selectedWord.word}'(뜻: ${selectedWord.meaning})를 사용하여 문장을 만들었습니다. 다음 기준으로 자세하게 피드백해주세요:

1. 먼저 칭찬하기 - 어떤 점이 잘되었는지 구체적으로 말해주기
2. 낱말을 왜 잘 사용했는지 이유 설명하기
3. 문장의 좋은 점을 찾아서 설명하기
4. 필요하면 더 좋아질 수 있는 방법 알려주기

피드백은 따뜻하고 쉬운 말로 3-4문장으로 작성하세요. 어려운 단어는 사용하지 마세요. 마지막에 질문은 하지 마세요.`
                              },
                              {
                                role: 'user',
                                content: userSentence
                              }
                            ]
                          })
                        })

                        if (!response.ok) throw new Error('피드백을 받는데 실패했습니다.')

                        const data = await response.json()
                        setWordFeedback(data.reply)
                      } catch (error) {
                        console.error('Feedback error:', error)
                        setWordFeedback('피드백을 받는데 오류가 발생했습니다. 다시 시도해주세요.')
                      } finally {
                        setSubmittingWord(false)
                      }
                    }}
                    disabled={submittingWord || !userSentence.trim()}
                  >
                    {submittingWord ? '피드백 받는 중...' : '세종대왕께 제출하기'}
                  </button>
                </div>

                {wordFeedback && (
                  <div className="word-feedback">
                    <div className="feedback-header">
                      <img src="/sejong-avata.png" alt="세종대왕" className="feedback-avatar" />
                      <h3>세종대왕의 피드백</h3>
                    </div>
                    <div className="feedback-content">
                      {wordFeedback}
                    </div>
                    <button
                      className="feedback-close-btn"
                      onClick={() => {
                        setSelectedWord(null)
                        setUserSentence('')
                        setWordFeedback(null)
                      }}
                    >
                      다른 낱말로 연습하기
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'book' && (
          <BookReader />
        )}
      </div>
    </div>
  )
}

// 그림책 읽기 컴포넌트
function BookReader() {
  const [currentSpread, setCurrentSpread] = useState(0) // 0-based: 0 = pages 1-2, 1 = pages 3-4, etc.
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationDirection, setAnimationDirection] = useState<'next' | 'prev' | null>(null)
  const totalPages = 10
  const totalSpreads = Math.ceil(totalPages / 2) // 5 spreads

  const nextPage = () => {
    if (currentSpread < totalSpreads - 1 && !isAnimating) {
      setAnimationDirection('next')
      setIsAnimating(true)

      setTimeout(() => {
        setCurrentSpread(currentSpread + 1)
      }, 400) // 애니메이션 중간에 페이지 변경

      setTimeout(() => {
        setIsAnimating(false)
        setAnimationDirection(null)
      }, 800)
    }
  }

  const prevPage = () => {
    if (currentSpread > 0 && !isAnimating) {
      setAnimationDirection('prev')
      setIsAnimating(true)

      setTimeout(() => {
        setCurrentSpread(currentSpread - 1)
      }, 400) // 애니메이션 중간에 페이지 변경

      setTimeout(() => {
        setIsAnimating(false)
        setAnimationDirection(null)
      }, 800)
    }
  }

  // 현재 보여줄 왼쪽/오른쪽 페이지 번호 계산
  const leftPageNum = currentSpread * 2 + 1
  const rightPageNum = currentSpread * 2 + 2

  return (
    <div className="book-mode">
      <div className="chat-header">
        <h1>세종대왕 이야기</h1>
        <p>그림책을 읽어보세요</p>
      </div>

      <div className="book-container">
        <div className="book-content">
          <div className="book-spread">
            {/* 왼쪽 페이지 */}
            <div className="book-page book-page-left">
              <img
                src={`/book${leftPageNum}.png`}
                alt={`세종대왕 이야기 ${leftPageNum}페이지`}
                className="book-image"
              />
            </div>

            {/* 오른쪽 페이지 (넘어가는 애니메이션) */}
            <div className={`book-page book-page-right ${animationDirection === 'next' ? 'page-turning-next' : ''} ${animationDirection === 'prev' ? 'page-turning-prev' : ''}`}>
              <img
                src={`/book${rightPageNum}.png`}
                alt={`세종대왕 이야기 ${rightPageNum}페이지`}
                className="book-image"
              />
            </div>
          </div>

          <div className="book-controls">
            <button
              className="book-nav-btn"
              onClick={prevPage}
              disabled={currentSpread === 0 || isAnimating}
            >
              ◀ 이전
            </button>

            <div className="book-page-indicator">
              {leftPageNum}-{rightPageNum} / {totalPages}
            </div>

            <button
              className="book-nav-btn"
              onClick={nextPage}
              disabled={currentSpread === totalSpreads - 1 || isAnimating}
            >
              다음 ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App