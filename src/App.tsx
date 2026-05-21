import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useClerk,
  useSignIn,
  useUser
} from '@clerk/clerk-react'
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc as firestoreDoc, onSnapshot, limit } from 'firebase/firestore'
import { onAuthStateChanged, signInWithCustomToken, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth'
import { auth, db } from './lib/firebase'
import HeroImage from './assets/Foto Login.avif'
import LogoImage from './assets/logo Umibi Italia.png'
import { productCatalog, type ProductCatalogItem } from './lib/productCatalog'
import ExcelJS from 'exceljs'

type HomeSection = 'home' | 'new-order' | 'history' | 'contacts' | 'cart' | 'admin'

type CartItem = ProductCatalogItem & {
  quantity: number
}

type OrderHistoryStatus = 'confirmed' | 'email-failed' | 'processing' | 'shipped' | 'cancelled'

type OrderHistoryItem = {
  id: string
  createdAt: string
  customerName: string
  customerEmail: string
  ownerUid?: string
  ownerEmail?: string
  items: CartItem[]
  total: number
  status?: OrderHistoryStatus
}

type AdminOrderItem = OrderHistoryItem & { firestoreId: string }

const ORDER_RECEIVER_EMAIL = 'alessandra.gruosso@alma-studiomarketing.com'
const ADMIN_EMAILS = ['alessandra.gruosso@alma-studiomarketing.com', 'marco.gerli@ssisrl.net', 'alessandra.gruosso@outlook.it']
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send'
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const ADMIN_NOTIFY_LAST_SEEN_KEY = 'umibi-admin-notify-last-seen'

const clerkAppearance = {
  elements: {
    rootBox: 'clerk-root',
    card: 'clerk-card',
    headerTitle: 'clerk-hidden',
    headerSubtitle: 'clerk-hidden',
    socialButtonsBlockButton: 'ghost-button clerk-social-button',
    socialButtonsBlockButtonText: 'clerk-social-text',
    dividerLine: 'clerk-divider-line',
    dividerText: 'clerk-divider-text',
    formFieldLabel: 'clerk-label',
    formFieldInput: 'clerk-input',
    formButtonPrimary: 'submit-button clerk-submit-button',
    footerActionLink: 'clerk-link',
    identityPreviewEditButton: 'clerk-link',
    formFieldSuccessText: 'form-info',
    alertText: 'form-error',
    formResendCodeLink: 'clerk-link'
  }
} as const

function OrderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 6.5H20" />
      <path d="M4 12H14" />
      <path d="M4 17.5H12" />
      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l2.7 2.7" />
    </svg>
  )
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21 15.5a2 2 0 0 1-.65 1.48A17 17 0 0 1 8.02 4.65 2 2 0 0 1 9.5 4h2a1.25 1.25 0 0 1 1.22 1l.43 2.17a1.25 1.25 0 0 1-.35 1.14l-1.2 1.2a13 13 0 0 0 4.8 4.8l1.2-1.2a1.25 1.25 0 0 1 1.14-.35l2.17.43a1.25 1.25 0 0 1 1 1.22z" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
      <path d="M3 4h2l2.1 10.3a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 7H7" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function formatQuantity(quantity: number, unit: string) {
  const formattedQuantity = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')

  if (unit === 'kg') {
    return `${formattedQuantity} kg`
  }

  return `${formattedQuantity} pz`
}

function parseUnitPrice(price: string) {
  const parsed = Number(price.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatAmountForTemplate(value: number | string) {
  const numericValue = typeof value === 'number' ? value : parseUnitPrice(value)

  return numericValue.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatEuroAmount(value: number | string) {
  return `${formatAmountForTemplate(value)} €`
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function normalizeOrderHistory(value: unknown): OrderHistoryItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is OrderHistoryItem => {
    if (!item || typeof item !== 'object') {
      return false
    }

    const candidate = item as Partial<OrderHistoryItem>
    return typeof candidate.id === 'string' && Array.isArray(candidate.items) && typeof candidate.total === 'number'
  })
}

function mergeOrderHistories(...histories: OrderHistoryItem[][]) {
  const uniqueOrders = new Map<string, OrderHistoryItem>()

  histories.flat().reverse().forEach((order) => {
    uniqueOrders.set(order.id, order)
  })

  return Array.from(uniqueOrders.values())
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 30)
}

function App() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login')
  const [fpEmail, setFpEmail] = useState('')
  const [fpCode, setFpCode] = useState('')
  const [fpPassword, setFpPassword] = useState('')
  const [fpError, setFpError] = useState('')
  const [fpLoading, setFpLoading] = useState(false)
  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const [section, setSection] = useState<HomeSection>('home')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})
  const [cartQuantityInputs, setCartQuantityInputs] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Tutte')
  const [orderMessage, setOrderMessage] = useState('')
  const [orderError, setOrderError] = useState('')
  const [isSendingOrder, setIsSendingOrder] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [recentlyAddedProduct, setRecentlyAddedProduct] = useState<string | null>(null)
  const [adminOrders, setAdminOrders] = useState<AdminOrderItem[]>([])
  const [adminFilter, setAdminFilter] = useState('')
  const [adminLoaded, setAdminLoaded] = useState(false)
  const [adminExpandedId, setAdminExpandedId] = useState<string | null>(null)
  const [adminNotificationPermission, setAdminNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'default'
    }
    return Notification.permission
  })
  const [adminNotificationsEnabled, setAdminNotificationsEnabled] = useState(false)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false)
  const [firebaseSyncing, setFirebaseSyncing] = useState(false)
  const [firebaseSyncError, setFirebaseSyncError] = useState('')
  const authCardRef = useRef<HTMLElement | null>(null)
  const { signOut } = useClerk()
  const { user } = useUser()
  const { getToken, isLoaded: clerkAuthLoaded, isSignedIn } = useAuth()
  const products = useMemo<ProductCatalogItem[]>(() => productCatalog, [])

  const userName = useMemo(() => {
    if (!user) {
      return 'Cliente'
    }

    return user.fullName || user.firstName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Cliente'
  }, [user])

  const userEmail = user?.primaryEmailAddress?.emailAddress || ''
  const isAdmin = ADMIN_EMAILS.includes(userEmail)
  const firebaseLoginUid = user?.id ? `clerk_${user.id}` : ''

  const historyStorageKey = useMemo(() => {
    if (!userEmail) {
      return ''
    }

    return `umibi-order-history:${userEmail.trim().toLowerCase()}`
  }, [userEmail])

  const categories = useMemo(() => ['Tutte', ...new Set(products.map((product) => product.category))], [products])

  const openAuthMode = (nextMode: 'login' | 'register' | 'forgot' | 'reset') => {
    setMode(nextMode)

    window.setTimeout(() => {
      authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      const firstInput = authCardRef.current?.querySelector(
        'input[type="email"], input[type="text"], input[type="password"]'
      ) as HTMLInputElement | null

      firstInput?.focus()
      firstInput?.select()
    }, 180)
  }

  const saveOrderToFirestore = async (entry: OrderHistoryItem) => {
    try {
      await addDoc(collection(db, 'orders'), {
        ...entry,
        ownerUid: firebaseUser?.uid || firebaseLoginUid,
        ownerEmail: userEmail,
        items: entry.items.map((item) => ({
          name: item.name,
          price: item.price,
          unit: item.unit,
          quantity: item.quantity,
          category: item.category,
          imageUrl: item.imageUrl,
        })),
      })
    } catch (error) {
      console.error('Errore salvataggio ordine su Firestore:', error)
    }
  }

  const loadOrdersFromFirestore = async (email: string): Promise<OrderHistoryItem[]> => {
    if (!firebaseAuthReady || !firebaseUser) {
      return []
    }

    try {
      const q = query(
        collection(db, 'orders'),
        where('customerEmail', '==', email),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map((snap) => snap.data() as OrderHistoryItem)
    } catch (error) {
      console.error('Errore caricamento ordini da Firestore:', error)
      return []
    }
  }

  const persistOrderHistory = (...histories: OrderHistoryItem[][]) => {
    const mergedHistory = mergeOrderHistories(...histories)

    setOrderHistory(mergedHistory)

    if (historyStorageKey) {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(mergedHistory))
    }

    if (user?.id) {
      void user
        .update({
          unsafeMetadata: {
            ...(user.unsafeMetadata ?? {}),
            umibiOrderHistory: mergedHistory
          }
        })
        .catch((error) => {
          console.error('Impossibile sincronizzare lo storico ordini.', error)
        })
    }
  }

  useEffect(() => {
    if (!recentlyAddedProduct) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyAddedProduct(null)
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [recentlyAddedProduct])

  useEffect(() => {
    setCartQuantityInputs(
      Object.fromEntries(
        cartItems.map((item) => [item.name, String(item.quantity)])
      )
    )
  }, [cartItems])

  useEffect(() => {
    if (section === 'new-order') {
      setQuantityInputs({})
      setOrderError('')
    }
    if (section === 'admin' && isAdmin && firebaseAuthReady && firebaseUser) {
      setAdminLoaded(false)
      void loadAllOrdersFromFirestore().then((orders) => {
        setAdminOrders(orders)
        setAdminLoaded(true)
      })
    }
  }, [section, isAdmin, firebaseAuthReady, firebaseUser?.uid])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser)
      setFirebaseAuthReady(true)
    })

    return unsubscribe
  }, [])

  const syncFirebaseSession = useCallback(async () => {
    if (!clerkAuthLoaded || !firebaseAuthReady) {
      return
    }

    if (!isSignedIn) {
      setFirebaseSyncError('')

      if (auth.currentUser) {
        await firebaseSignOut(auth)
      }

      return
    }

    if (firebaseUser?.uid === firebaseLoginUid && auth.currentUser) {
      setFirebaseSyncError('')
      return
    }

    setFirebaseSyncing(true)
    setFirebaseSyncError('')

    try {
      const clerkToken = await getToken()

      if (!clerkToken) {
        throw new Error('Token Clerk non disponibile.')
      }

      const response = await fetch('/api/firebase-token', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkToken}`
        }
      })

      const payload = (await response.json()) as { firebaseToken?: string; error?: string }

      if (!response.ok || !payload.firebaseToken) {
        throw new Error(payload.error || 'Impossibile creare il token Firebase.')
      }

      await signInWithCustomToken(auth, payload.firebaseToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile collegare Firebase.'
      setFirebaseSyncError(message)
    } finally {
      setFirebaseSyncing(false)
    }
  }, [clerkAuthLoaded, firebaseAuthReady, firebaseLoginUid, firebaseUser?.uid, getToken, isSignedIn])

  useEffect(() => {
    void syncFirebaseSession()
  }, [syncFirebaseSession])

  useEffect(() => {
    if (!historyStorageKey) {
      setOrderHistory([])
      setHistoryLoaded(false)
      return
    }

    if (!firebaseAuthReady || !firebaseUser) {
      return
    }

    setHistoryLoaded(false)

    const load = async () => {
      try {
        const raw = window.localStorage.getItem(historyStorageKey)
        const localHistory = raw ? normalizeOrderHistory(JSON.parse(raw)) : []
        const remoteHistory = normalizeOrderHistory(user?.unsafeMetadata?.umibiOrderHistory)
        const firestoreHistory = userEmail ? await loadOrdersFromFirestore(userEmail) : []

        setOrderHistory(mergeOrderHistories(localHistory, remoteHistory, firestoreHistory))
      } catch {
        setOrderHistory(normalizeOrderHistory(user?.unsafeMetadata?.umibiOrderHistory))
      } finally {
        setHistoryLoaded(true)
      }
    }

    void load()
  }, [historyStorageKey, firebaseAuthReady, firebaseUser?.uid, user?.unsafeMetadata?.umibiOrderHistory, userEmail])

  useEffect(() => {
    if (!historyStorageKey || !historyLoaded) {
      return
    }

    window.localStorage.setItem(historyStorageKey, JSON.stringify(orderHistory))
  }, [historyStorageKey, historyLoaded, orderHistory])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (Notification.permission === 'granted') {
      setAdminNotificationsEnabled(true)
      setAdminNotificationPermission('granted')
    }
  }, [])

  useEffect(() => {
    if (!isAdmin || !adminNotificationsEnabled || !firebaseAuthReady || !firebaseUser || typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    const rawLastSeen = window.localStorage.getItem(ADMIN_NOTIFY_LAST_SEEN_KEY)
    let lastSeen = rawLastSeen ? Number(rawLastSeen) : Date.now()

    if (!rawLastSeen) {
      window.localStorage.setItem(ADMIN_NOTIFY_LAST_SEEN_KEY, String(lastSeen))
    }

    const adminOrdersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(20)
    )

    const unsubscribe = onSnapshot(
      adminOrdersQuery,
      (snapshot) => {
        let latestSeen = lastSeen

        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') {
            return
          }

          const order = change.doc.data() as Partial<OrderHistoryItem>
          const createdAtMs = order.createdAt ? new Date(order.createdAt).getTime() : Date.now()

          if (createdAtMs > latestSeen) {
            latestSeen = createdAtMs
          }

          if (createdAtMs <= lastSeen) {
            return
          }

          const orderLabel = order.id ? ` (${order.id})` : ''
          const customerLabel = order.customerName || 'Cliente'
          const notificationTitle = `Nuovo ordine${orderLabel}`
          const notificationBody = `${customerLabel} ha inviato un nuovo ordine.`

          void (async () => {
            try {
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration()
                if (registration) {
                  await registration.showNotification(notificationTitle, {
                    body: notificationBody,
                    icon: '/pwa-logo.png',
                    badge: '/pwa-logo.png',
                    tag: `order-${order.id ?? change.doc.id}`
                  })
                  return
                }
              }

              new Notification(notificationTitle, {
                body: notificationBody,
                icon: '/pwa-logo.png',
                tag: `order-${order.id ?? change.doc.id}`
              })
            } catch (error) {
              console.error('Impossibile inviare notifica admin.', error)
            }
          })()
        })

        if (latestSeen !== lastSeen) {
          lastSeen = latestSeen
          window.localStorage.setItem(ADMIN_NOTIFY_LAST_SEEN_KEY, String(latestSeen))
        }
      },
      (error) => {
        console.error('Errore ascolto notifiche admin.', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [isAdmin, adminNotificationsEnabled, firebaseAuthReady, firebaseUser?.uid])

  const requestAdminNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setAdminNotificationPermission(permission)
      setAdminNotificationsEnabled(permission === 'granted')
    } catch (error) {
      console.error('Permesso notifiche non concesso.', error)
    }
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return products.filter((product) => {
      const matchesCategory = selectedCategory === 'Tutte' || product.category === selectedCategory
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [products, searchTerm, selectedCategory])

  const setQuantityValue = (productName: string, value: string) => {
    setQuantityInputs((current) => ({
      ...current,
      [productName]: value
    }))
  }

  const addToCart = (product: ProductCatalogItem) => {
    const rawValue = quantityInputs[product.name] || '1'
    const parsedValue = Number(rawValue.replace(',', '.'))
    const minStep = 1

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setOrderError(`Inserisci una quantita valida per ${product.name}.`)
      setOrderMessage('')
      return
    }

    const normalizedQuantity = Math.round(parsedValue)

    if (normalizedQuantity < minStep) {
      setOrderError(`La quantita minima per ${product.name} e ${minStep} ${product.unit}.`)
      setOrderMessage('')
      return
    }

    setCartItems((current) => {
      const existingItem = current.find((item) => item.name === product.name)
      if (existingItem) {
        const nextQuantity = Math.round(existingItem.quantity + normalizedQuantity)

        return current.map((item) =>
          item.name === product.name
            ? {
                ...item,
                quantity: nextQuantity
              }
            : item
        )
      }

      return [...current, { ...product, quantity: normalizedQuantity }]
    })

    setQuantityInputs((current) => ({ ...current, [product.name]: '1' }))
    setOrderError('')
    setOrderMessage('')
    setRecentlyAddedProduct(product.name)
  }

  const updateCartQuantity = (productName: string, nextQuantity: number) => {
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      return
    }

    setCartItems((current) =>
      current.map((item) => (item.name === productName ? { ...item, quantity: nextQuantity } : item))
    )
  }

  const setCartQuantityValue = (productName: string, value: string) => {
    setCartQuantityInputs((current) => ({
      ...current,
      [productName]: value
    }))
  }

  const commitCartQuantity = (item: CartItem) => {
    const rawValue = (cartQuantityInputs[item.name] ?? String(item.quantity)).trim()

    if (!rawValue) {
      setCartQuantityInputs((current) => ({
        ...current,
        [item.name]: String(item.quantity)
      }))
      return
    }

    const parsedValue = Number(rawValue.replace(',', '.'))
    const normalizedQuantity = Math.round(parsedValue)

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setCartQuantityInputs((current) => ({
        ...current,
        [item.name]: String(item.quantity)
      }))
      return
    }

    updateCartQuantity(item.name, normalizedQuantity)
  }

  const removeFromCart = (productName: string) => {
    setCartItems((current) => current.filter((item) => item.name !== productName))
  }

  const restoreOrderToCart = (historicalOrder: OrderHistoryItem) => {
    const restoredItems = historicalOrder.items.map((item) => ({ ...item }))

    setQuantityInputs({})
    setCartQuantityInputs(Object.fromEntries(restoredItems.map((item) => [item.name, String(item.quantity)])))
    setCartItems(restoredItems)
    setOrderError('')
    setOrderMessage(`Ordine ${historicalOrder.id} caricato nel carrello. Ora puoi modificarlo e reinviarlo.`)
    setSection('cart')
  }

  const loadAllOrdersFromFirestore = async (): Promise<AdminOrderItem[]> => {
    if (!firebaseAuthReady || !firebaseUser) {
      return []
    }

    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map((snap) => ({
        ...(snap.data() as OrderHistoryItem),
        firestoreId: snap.id
      }))
    } catch (error) {
      console.error('Errore caricamento ordini admin:', error)
      return []
    }
  }

  const updateOrderStatusInFirestore = async (firestoreId: string, newStatus: OrderHistoryStatus) => {
    if (!firebaseAuthReady || !firebaseUser) {
      return
    }

    try {
      await updateDoc(firestoreDoc(db, 'orders', firestoreId), { status: newStatus })
      setAdminOrders((current) =>
        current.map((order) => (order.firestoreId === firestoreId ? { ...order, status: newStatus } : order))
      )
    } catch (error) {
      console.error('Errore aggiornamento stato ordine:', error)
    }
  }

  const sendEmailWithEmailJs = async (templateParams: Record<string, unknown>) => {
    const response = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(errorBody || 'EmailJS request failed.')
    }
  }

  const sendForgotCode = async () => {
    if (!signInLoaded || !signIn) return
    setFpError('')
    setFpLoading(true)
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: fpEmail })
      setMode('reset')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore. Riprova.'
      setFpError(msg)
    } finally {
      setFpLoading(false)
    }
  }

  const sendResetPassword = async () => {
    if (!signInLoaded || !signIn) return
    setFpError('')
    setFpLoading(true)
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code: fpCode })
      if (result.status === 'needs_new_password') {
        await signIn.resetPassword({ password: fpPassword })
      }
      setMode('login')
      setFpEmail('')
      setFpCode('')
      setFpPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore. Riprova.'
      setFpError(msg)
    } finally {
      setFpLoading(false)
    }
  }

  const sendOrder = async () => {
    if (!cartItems.length) {
      setOrderError('Il carrello e vuoto.')
      setOrderMessage('')
      return
    }

    if (!firebaseUser) {
      setOrderError('Connessione sicura non pronta. Attendi un momento e riprova.')
      setOrderMessage('')
      return
    }

    if (!userEmail) {
      setOrderError('Email cliente non disponibile. Verifica il tuo account.')
      setOrderMessage('')
      return
    }

    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      setOrderError('Invio automatico non configurato. Imposta VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID e VITE_EMAILJS_PUBLIC_KEY.')
      setOrderMessage('')
      return
    }

    const orderLines = cartItems
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} | ${formatEuroAmount(item.price)} / ${item.unit} | Quantita: ${formatQuantity(item.quantity, item.unit)}`
      )
      .join('\n')

    const companySubject = `Nuovo ordine Umibi Italia - ${userName}`
    const customerSubject = `Conferma ordine Umibi Italia - ${userName}`
    const orderId = `UMI-${Date.now()}`
    const orderItems = cartItems.map((item) => ({
      name: item.name,
      units: formatQuantity(item.quantity, item.unit),
      price: `${formatAmountForTemplate(item.price)} / ${item.unit}`,
      image_url: item.imageUrl
    }))
    const subtotal = cartItems.reduce((sum, item) => sum + parseUnitPrice(item.price) * item.quantity, 0)
    const shippingCost = 0
    const taxCost = 0
    const totalCost = subtotal + shippingCost + taxCost
    const orderBody = [
      `Cliente: ${userName}`,
      `Email cliente: ${userEmail}`,
      `Numero ordine: ${orderId}`,
      '',
      'Riepilogo ordine:',
      orderLines,
      '',
      `Totale ordine: ${formatEuroAmount(totalCost)}`,
      '',
      'Ordine inviato dalla piattaforma Umibi Italia.'
    ].join('\n')
    const historyEntry: OrderHistoryItem = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: userName,
      customerEmail: userEmail,
      ownerUid: firebaseUser.uid,
      ownerEmail: userEmail,
      items: cartItems.map((item) => ({ ...item })),
      total: Number(totalCost.toFixed(2)),
      status: 'confirmed'
    }

    try {
      setIsSendingOrder(true)
      setOrderError('')
      persistOrderHistory([{ ...historyEntry, status: 'confirmed' }], orderHistory)

      // Salva ordine su Firebase Firestore
      await saveOrderToFirestore({ ...historyEntry, status: 'confirmed' })

      await sendEmailWithEmailJs({
        to_email: ORDER_RECEIVER_EMAIL,
        to_name: 'Umibi Italia',
        subject: companySubject,
        message: orderBody,
        reply_to: userEmail,
        customer_name: userName,
        customer_email: userEmail,
        email: ORDER_RECEIVER_EMAIL,
        order_id: orderId,
        currency: 'EUR',
        currency_symbol: '€',
        order_summary: orderLines,
        order_total: formatEuroAmount(totalCost),
        orders: orderItems,
        cost: {
          shipping: formatAmountForTemplate(shippingCost),
          tax: formatAmountForTemplate(taxCost),
          total: formatAmountForTemplate(totalCost)
        }
      })

      await wait(1200)

      await sendEmailWithEmailJs({
        to_email: userEmail,
        to_name: userName,
        subject: customerSubject,
        message: orderBody,
        reply_to: userEmail,
        customer_name: userName,
        customer_email: userEmail,
        email: userEmail,
        order_id: orderId,
        currency: 'EUR',
        currency_symbol: '€',
        order_summary: orderLines,
        order_total: formatEuroAmount(totalCost),
        orders: orderItems,
        cost: {
          shipping: formatAmountForTemplate(shippingCost),
          tax: formatAmountForTemplate(taxCost),
          total: formatAmountForTemplate(totalCost)
        }
      })

      persistOrderHistory([{ ...historyEntry, status: 'confirmed' }], orderHistory)

      setOrderMessage('Grazie, il tuo ordine è stato inviato con successo. Una copia con il dettaglio degli articoli richiesti è stata trasmessa alla tua casella di posta. In caso di modifiche o integrazioni, ti invitiamo a contattare il commerciale Umibi.')
      setCartItems([])
    } catch (error) {
      persistOrderHistory([{ ...historyEntry, status: 'email-failed' }], orderHistory)
      setOrderMessage('')
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto.'
      setOrderError(`Invio automatico fallito: ${errorMessage}`)
      console.error(error)
    } finally {
      setIsSendingOrder(false)
    }
  }

  const exportAdminExcel = async () => {
    const workbook = new ExcelJS.Workbook()

    const statusLabel: Record<string, string> = {
      confirmed: 'Confermato',
      processing: 'In lavorazione',
      shipped: 'Spedito',
      cancelled: 'Annullato',
      'email-failed': 'Email fallita'
    }

    const ordersSheet = workbook.addWorksheet('Tutti gli ordini')
    ordersSheet.columns = [
      { header: 'ID Ordine', key: 'orderId', width: 14 },
      { header: 'Data', key: 'date', width: 14 },
      { header: 'Cliente', key: 'customerName', width: 22 },
      { header: 'Email', key: 'customerEmail', width: 30 },
      { header: 'Articoli', key: 'items', width: 60 },
      { header: 'Totale (€)', key: 'total', width: 12 },
      { header: 'Stato', key: 'status', width: 16 }
    ]

    adminOrders.forEach((order) => {
      ordersSheet.addRow({
        orderId: order.id,
        date: new Date(order.createdAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }),
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        items: order.items.map((i) => `${i.name} x${formatQuantity(i.quantity, i.unit)}`).join(' | '),
        total: Number(order.total.toFixed(2)),
        status: statusLabel[order.status ?? 'confirmed'] ?? (order.status ?? 'Confermato')
      })
    })

    const activeOrders = adminOrders.filter((o) => o.status !== 'cancelled')
    const totalRevenue = activeOrders.reduce((sum, o) => sum + o.total, 0)
    const avgOrderValue = activeOrders.length ? totalRevenue / activeOrders.length : 0
    const customerSet = new Set(activeOrders.map((o) => o.customerEmail))
    const statusCounts: Record<string, number> = {}

    for (const order of adminOrders) {
      const status = order.status ?? 'confirmed'
      statusCounts[status] = (statusCounts[status] ?? 0) + 1
    }

    const statsSheet = workbook.addWorksheet('Statistiche')
    statsSheet.columns = [
      { header: 'Indicatore', key: 'indicator', width: 28 },
      { header: 'Valore', key: 'value', width: 18 }
    ]

    statsSheet.addRows([
      { indicator: 'Ordini totali', value: adminOrders.length },
      { indicator: 'Fatturato totale (€)', value: Number(totalRevenue.toFixed(2)) },
      { indicator: 'Valore medio ordine (€)', value: Number(avgOrderValue.toFixed(2)) },
      { indicator: 'Clienti attivi', value: customerSet.size },
      { indicator: '', value: '' },
      { indicator: 'Stato', value: 'Conteggio' },
      ...Object.entries(statusCounts).map(([status, count]) => ({
        indicator: statusLabel[status] ?? status,
        value: count
      }))
    ])

    const customerMap: Record<string, { name: string; email: string; count: number; revenue: number }> = {}

    for (const order of activeOrders) {
      if (!customerMap[order.customerEmail]) {
        customerMap[order.customerEmail] = {
          name: order.customerName,
          email: order.customerEmail,
          count: 0,
          revenue: 0
        }
      }
      customerMap[order.customerEmail].count += 1
      customerMap[order.customerEmail].revenue += order.total
    }

    const customersSheet = workbook.addWorksheet('Top clienti')
    customersSheet.columns = [
      { header: 'Cliente', key: 'customerName', width: 24 },
      { header: 'Email', key: 'customerEmail', width: 32 },
      { header: 'N° Ordini', key: 'count', width: 10 },
      { header: 'Fatturato (€)', key: 'revenue', width: 16 }
    ]

    Object.values(customerMap)
      .sort((left, right) => right.revenue - left.revenue)
      .forEach((customer) => {
        customersSheet.addRow({
          customerName: customer.name,
          customerEmail: customer.email,
          count: customer.count,
          revenue: Number(customer.revenue.toFixed(2))
        })
      })

    const productMap: Record<string, { quantity: number; unit: string }> = {}
    for (const order of activeOrders) {
      for (const item of order.items) {
        if (!productMap[item.name]) {
          productMap[item.name] = { quantity: 0, unit: item.unit }
        }
        productMap[item.name].quantity += item.quantity
      }
    }

    const productsSheet = workbook.addWorksheet('Prodotti')
    productsSheet.columns = [
      { header: 'Prodotto', key: 'productName', width: 40 },
      { header: 'Quantità totale', key: 'quantity', width: 16 },
      { header: 'Unità', key: 'unit', width: 8 }
    ]

    Object.entries(productMap)
      .sort((left, right) => right[1].quantity - left[1].quantity)
      .forEach(([name, item]) => {
        productsSheet.addRow({
          productName: name,
          quantity: item.quantity,
          unit: item.unit
        })
      })

    const buffer = await workbook.xlsx.writeBuffer()
    const fileBlob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileUrl = window.URL.createObjectURL(fileBlob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.href = fileUrl
    link.download = `Umibi-Export-${dateStr}.xlsx`
    link.click()
    window.URL.revokeObjectURL(fileUrl)
  }

  const renderSignedInContent = () => {
    if (firebaseSyncError) {
      return (
        <div className="order-page">
          <p className="form-error order-feedback">Connessione a Firebase non riuscita: {firebaseSyncError}</p>
          <button className="submit-button" onClick={() => void syncFirebaseSession()} disabled={firebaseSyncing}>
            {firebaseSyncing ? 'Riprovo...' : 'Riprova connessione'}
          </button>
        </div>
      )
    }

    if (!firebaseAuthReady || !firebaseUser) {
      return (
        <div className="order-page">
          <p className="cart-empty">Connessione sicura all'account in corso...</p>
        </div>
      )
    }

    if (section === 'new-order') {
      return (
        <div className="order-page">
          <div className="order-header">
            <div>
              <p className="eyebrow">Nuovo Ordine</p>
              <h2>Seleziona prodotti e quantita</h2>
            </div>
            <button className="ghost-button" onClick={() => setSection('home')}>
              Torna alla home
            </button>
          </div>

          <div className="order-toolbar">
            <label className="order-filter-field">
              <span>Cerca prodotto</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Es. Salmone"
              />
            </label>
            <label className="order-filter-field">
              <span>Categoria</span>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {orderError && <p className="form-error order-feedback">{orderError}</p>}

          <div className="order-table-wrap">
            <table className="order-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Categoria</th>
                    <th>Prodotto</th>
                    <th>Prezzo</th>
                    <th>Unita</th>
                    <th>Quantita</th>
                    <th></th>
                  </tr>
                </thead>
              <tbody>
                {filteredProducts.length ? (
                  filteredProducts.map((product, index) => (
                    <tr key={`${product.category}-${product.name}-${index}`}>
                      <td className="order-photo-cell" data-label="Foto">
                        <img src={product.imageUrl} alt={product.name} className="order-thumb" />
                      </td>
                      <td data-label="Categoria">{product.category}</td>
                      <td data-label="Prodotto">{product.name}</td>
                      <td data-label="Prezzo">{product.price} €</td>
                      <td data-label="Unità">{product.unit}</td>
                      <td data-label="Quantità">
                        <input
                          className="qty-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantityInputs[product.name] ?? '1'}
                          onChange={(event) => setQuantityValue(product.name, event.target.value)}
                          onFocus={(event) => event.target.select()}
                          placeholder="1"
                        />
                      </td>
                      <td className="order-action-cell" data-label="Azione">
                        <button className="submit-button add-cart-button" onClick={() => addToCart(product)}>
                          Aggiungi
                        </button>
                        {recentlyAddedProduct === product.name ? (
                          <p className="row-feedback" role="status" aria-live="polite">
                            Aggiunto al carrello
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="order-empty">
                      Nessun prodotto trovato con i filtri attuali.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (section === 'cart') {
      // Schermata di successo dopo invio ordine
      if (orderMessage) {
        return (
          <div className="order-page cart-page">
            <div className="order-header">
              <div>
                <p className="eyebrow">Ordine Inviato</p>
                <h2>Grazie!</h2>
              </div>
            </div>
            <p className="form-info order-feedback">{orderMessage}</p>
            <div className="cart-footer-actions" style={{ marginTop: '16px' }}>
              <button className="ghost-button" onClick={() => { setOrderMessage(''); setSection('home') }}>
                Torna alla home
              </button>
              <button className="submit-button" onClick={() => { setOrderMessage(''); setSection('history') }}>
                Vedi storico ordini
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="order-page cart-page">
          <div className="order-header">
            <div>
              <p className="eyebrow">Carrello</p>
              <h2>{cartItems.length} articoli selezionati</h2>
            </div>
            <button className="ghost-button" onClick={() => setSection('home')}>
              Torna alla home
            </button>
          </div>

          <div className="cart-items">
            {cartItems.length ? (
              cartItems.map((item) => (
                <div key={item.name} className="cart-item">
                  <img src={item.imageUrl} alt={item.name} className="cart-thumb" />
                  <div className="cart-item-copy">
                    <strong>{item.name}</strong>
                    <span>{item.price} € / {item.unit}</span>
                    <div className="cart-item-controls">
                      <input
                        className="qty-input cart-qty-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={cartQuantityInputs[item.name] ?? String(item.quantity)}
                        onChange={(event) => setCartQuantityValue(item.name, event.target.value)}
                        onBlur={() => commitCartQuantity(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitCartQuantity(item)
                          }
                        }}
                      />
                      <span>{formatQuantity(item.quantity, item.unit)}</span>
                    </div>
                  </div>
                  <button className="cart-remove" onClick={() => removeFromCart(item.name)}>
                    Rimuovi
                  </button>
                </div>
              ))
            ) : (
              <p className="cart-empty">Aggiungi prodotti dal listino per comporre l'ordine.</p>
            )}
          </div>

          <div className="cart-footer-actions">
            <button className="ghost-button cart-clear" onClick={() => setCartItems([])} disabled={!cartItems.length}>
              Svuota
            </button>
            <button className="submit-button cart-submit" onClick={() => void sendOrder()} disabled={!cartItems.length || isSendingOrder}>
              {isSendingOrder ? 'Invio in corso...' : 'Invia Ordine'}
            </button>
          </div>

          {orderError && <p className="form-error order-feedback">{orderError}</p>}
          {orderMessage && <p className="form-info order-feedback">{orderMessage}</p>}
        </div>
      )
    }

    if (section === 'admin') {
      if (!isAdmin) {
        return (
          <div className="order-page">
            <p className="cart-empty">Accesso non autorizzato.</p>
          </div>
        )
      }

      const statusLabel: Record<string, string> = {
        confirmed: 'Confermato',
        processing: 'In lavorazione',
        shipped: 'Spedito',
        cancelled: 'Annullato',
        'email-failed': 'Email fallita'
      }

      const filteredAdminOrders = adminOrders.filter((order) => {
        if (!adminFilter.trim()) return true
        const term = adminFilter.trim().toLowerCase()
        return (
          order.customerName.toLowerCase().includes(term) ||
          order.customerEmail.toLowerCase().includes(term) ||
          order.id.toLowerCase().includes(term)
        )
      })

      // ── Statistiche ──────────────────────────────────────────
      const activeOrders = adminOrders.filter((o) => o.status !== 'cancelled')
      const totalRevenue = activeOrders.reduce((sum, o) => sum + o.total, 0)
      const avgOrderValue = activeOrders.length ? totalRevenue / activeOrders.length : 0

      const statusCounts: Record<string, number> = {}
      for (const order of adminOrders) {
        const s = order.status ?? 'confirmed'
        statusCounts[s] = (statusCounts[s] ?? 0) + 1
      }

      const customerMap: Record<string, { name: string; email: string; count: number; revenue: number }> = {}
      for (const order of activeOrders) {
        if (!customerMap[order.customerEmail]) {
          customerMap[order.customerEmail] = { name: order.customerName, email: order.customerEmail, count: 0, revenue: 0 }
        }
        customerMap[order.customerEmail].count += 1
        customerMap[order.customerEmail].revenue += order.total
      }
      const topCustomers = Object.values(customerMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
      const maxCustomerRevenue = topCustomers[0]?.revenue ?? 1

      const productMap: Record<string, { quantity: number; unit: string }> = {}
      for (const order of activeOrders) {
        for (const item of order.items) {
          if (!productMap[item.name]) productMap[item.name] = { quantity: 0, unit: item.unit }
          productMap[item.name].quantity += item.quantity
        }
      }
      const topProducts = Object.entries(productMap)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .slice(0, 5)
      const maxProductQty = topProducts[0]?.[1].quantity ?? 1

      return (
        <div className="order-page admin-page">
          <div className="order-header">
            <div>
              <p className="eyebrow">Pannello Admin</p>
              <h2>Tutti gli ordini</h2>
            </div>
            <button className="ghost-button" onClick={() => setSection('home')}>
              Torna alla home
            </button>
          </div>

          <div className="order-toolbar admin-toolbar">
            <label className="order-filter-field">
              <span>Cerca cliente o ordine</span>
              <input
                type="search"
                value={adminFilter}
                onChange={(event) => setAdminFilter(event.target.value)}
                placeholder="Es. Mario Rossi o UMI-..."
              />
            </label>
            <button
              className={`ghost-button admin-notify-btn${adminNotificationsEnabled ? ' admin-notify-btn--active' : ''}`}
              onClick={() => void requestAdminNotifications()}
              disabled={adminNotificationPermission === 'denied'}
              title={adminNotificationPermission === 'denied' ? 'Abilita le notifiche dal browser' : 'Attiva notifiche admin'}
            >
              {adminNotificationsEnabled ? 'Notifiche attive' : 'Attiva notifiche'}
            </button>
            <button
              className="submit-button admin-export-btn"
              onClick={exportAdminExcel}
              disabled={!adminLoaded || adminOrders.length === 0}
            >
              ↓ Esporta XLS
            </button>
            <p className="admin-summary">
              {adminLoaded ? `${filteredAdminOrders.length} ordini trovati` : 'Caricamento...'}
              {adminNotificationPermission === 'denied' ? ' · notifiche bloccate dal browser' : ''}
            </p>
          </div>

          {!adminLoaded ? (
            <p className="cart-empty">Caricamento ordini in corso...</p>
          ) : (
            <>
              {/* ── KPI cards ── */}
              <div className="admin-kpi-row">
                <div className="admin-kpi-card">
                  <p className="admin-kpi-label">Ordini totali</p>
                  <p className="admin-kpi-value">{adminOrders.length}</p>
                </div>
                <div className="admin-kpi-card">
                  <p className="admin-kpi-label">Fatturato totale</p>
                  <p className="admin-kpi-value">{totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                </div>
                <div className="admin-kpi-card">
                  <p className="admin-kpi-label">Valore medio ordine</p>
                  <p className="admin-kpi-value">{avgOrderValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                </div>
                <div className="admin-kpi-card">
                  <p className="admin-kpi-label">Clienti attivi</p>
                  <p className="admin-kpi-value">{Object.keys(customerMap).length}</p>
                </div>
              </div>

              {/* ── Stato ordini ── */}
              <div className="admin-stats-grid">
                <div className="admin-stats-card">
                  <h3 className="admin-stats-title">Ordini per stato</h3>
                  <div className="admin-status-breakdown">
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <div key={status} className="admin-status-row">
                        <span className={`admin-status-badge admin-status-badge--${status}`}>{statusLabel[status] ?? status}</span>
                        <span className="admin-status-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Top prodotti ── */}
                <div className="admin-stats-card">
                  <h3 className="admin-stats-title">Prodotti più ordinati</h3>
                  <div className="admin-bar-chart">
                    {topProducts.map(([name, { quantity, unit }]) => (
                      <div key={name} className="admin-bar-row">
                        <span className="admin-bar-label" title={name}>{name}</span>
                        <div className="admin-bar-track">
                          <div
                            className="admin-bar-fill admin-bar-fill--product"
                            style={{ width: `${(quantity / maxProductQty) * 100}%` }}
                          />
                        </div>
                        <span className="admin-bar-value">{formatQuantity(quantity, unit)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Top clienti per fatturato ── */}
                <div className="admin-stats-card admin-stats-card--wide">
                  <h3 className="admin-stats-title">Fatturato per cliente</h3>
                  <div className="admin-bar-chart">
                    {topCustomers.map((customer) => (
                      <div key={customer.email} className="admin-bar-row">
                        <span className="admin-bar-label" title={customer.name}>{customer.name}</span>
                        <div className="admin-bar-track">
                          <div
                            className="admin-bar-fill admin-bar-fill--customer"
                            style={{ width: `${(customer.revenue / maxCustomerRevenue) * 100}%` }}
                          />
                        </div>
                        <span className="admin-bar-value">
                          {customer.revenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          <span className="admin-bar-sub">({customer.count} ordini)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Lista ordini ── */}
              {filteredAdminOrders.length === 0 ? (
                <p className="cart-empty">Nessun ordine trovato.</p>
              ) : (
                <div className="history-list">
                  {filteredAdminOrders.map((order) => {
                    const isExpanded = adminExpandedId === order.firestoreId
                    const currentStatus = order.status ?? 'confirmed'

                    return (
                      <article className={`history-card admin-order-card admin-status--${currentStatus}`} key={order.firestoreId}>
                        <div className="history-card-head admin-card-head">
                          <div className="admin-card-info">
                            <strong>{order.id}</strong>
                            <p className="history-date">
                              {new Date(order.createdAt).toLocaleString('it-IT', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </p>
                            <p className="admin-customer">
                              <span className="admin-customer-name">{order.customerName}</span>
                              <a href={`mailto:${order.customerEmail}`} className="admin-customer-email">
                                {order.customerEmail}
                              </a>
                            </p>
                          </div>
                          <div className="admin-card-actions">
                            <select
                              className={`admin-status-select admin-status-select--${currentStatus}`}
                              value={currentStatus}
                              onChange={(event) =>
                                void updateOrderStatusInFirestore(order.firestoreId, event.target.value as OrderHistoryStatus)
                              }
                            >
                              <option value="confirmed">Confermato</option>
                              <option value="processing">In lavorazione</option>
                              <option value="shipped">Spedito</option>
                              <option value="cancelled">Annullato</option>
                              <option value="email-failed">Email fallita</option>
                            </select>
                            <button
                              className="ghost-button history-details"
                              onClick={() => setAdminExpandedId(isExpanded ? null : order.firestoreId)}
                            >
                              {isExpanded ? 'Chiudi' : 'Dettagli'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <>
                            <ul className="history-items" style={{ marginTop: '12px' }}>
                              {order.items.map((item) => (
                                <li key={`${order.firestoreId}-${item.name}`}>
                                  <span>{item.name}</span>
                                  <span>{item.price} € / {item.unit}</span>
                                  <span>{formatQuantity(item.quantity, item.unit)}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="history-total">
                              Totale: {order.total.toFixed(2).replace('.', ',')} € &nbsp;·&nbsp;
                              <span className={`admin-status-badge admin-status-badge--${currentStatus}`}>
                                {statusLabel[currentStatus] ?? currentStatus}
                              </span>
                            </p>
                          </>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )
    }

    if (section === 'history') {
      return (
        <div className="order-page history-page">
          <div className="order-header">
            <div>
              <p className="eyebrow">Storico</p>
              <h2>Ordini di {userName}</h2>
            </div>
            <button className="ghost-button" onClick={() => setSection('home')}>
              Torna alla home
            </button>
          </div>

          {orderHistory.length ? (
            <div className="history-list">
              {orderHistory.map((order) => {
                const isExpanded = expandedOrderId === order.id

                return (
                  <article className="history-card" key={order.id}>
                    <div className="history-card-head history-card-head--compact">
                      <div>
                        <strong>{order.id}</strong>
                        <p className="history-date" style={{ margin: '4px 0 0' }}>
                          {new Date(order.createdAt).toLocaleString('it-IT', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                      <div className="history-card-actions">
                        <button
                          className="ghost-button history-details"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        >
                          {isExpanded ? 'Chiudi dettagli' : 'Dettagli'}
                        </button>
                        <button className="submit-button history-reorder" onClick={() => restoreOrderToCart(order)}>
                          Riordina e modifica
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <>
                        <ul className="history-items" style={{ marginTop: '12px' }}>
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.name}`}>
                              <span>{item.name}</span>
                              <span>{item.price} € / {item.unit}</span>
                              <span>{formatQuantity(item.quantity, item.unit)}</span>
                            </li>
                          ))}
                        </ul>

                        <p className="history-total">Totale stimato: {order.total.toFixed(2).replace('.', ',')} €</p>
                        {order.status === 'email-failed' ? (
                          <p className="form-error order-feedback">Ordine salvato nello storico, ma email non confermata.</p>
                        ) : null}
                      </>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="cart-empty">Nessun ordine disponibile per questo account.</p>
          )}
        </div>
      )
    }

    if (section === 'contacts') {
      return (
        <div className="order-page contacts-page">
          <div className="order-header">
            <div>
              <p className="eyebrow">Contatti</p>
              <h2>Umibi Italia</h2>
            </div>
            <button className="ghost-button" onClick={() => setSection('home')}>
              Torna alla home
            </button>
          </div>

          <div className="contacts-showcase">
            <div className="contacts-brand-card">
              <img src={LogoImage} alt="Logo Umibi Italia" className="contacts-brand-logo" />
              <p className="eyebrow">Supporto diretto</p>
              <h3>Contatta Umibi Italia</h3>
              <p>
                Siamo a disposizione per informazioni commerciali, ordini, assistenza clienti e supporto operativo per la tua attività.
              </p>
            </div>

            <div className="contacts-visual-card">
              <img src={HeroImage} alt="Umibi Italia" className="contacts-hero-image" />
            </div>
          </div>

          <div className="contacts-grid">
            <div className="contacts-card">
              <h3>Sede Legale</h3>
              <p>Umibi Italia srl</p>
              <p>Strada Cesurni, n° 2</p>
              <p>20019 – Tivoli (RM)</p>
              <p>P.I. IT1811831102</p>
            </div>

            <div className="contacts-card">
              <h3>Contatti</h3>
              <p>
                <span className="contact-label">Email</span>
                <a href="mailto:info@umibi.fish" className="contact-link">info@umibi.fish</a>
              </p>
              <p>
                <span className="contact-label">Sito web</span>
                <a href="https://www.umibi.fish/umibi-italia" target="_blank" rel="noopener noreferrer" className="contact-link">
                  www.umibi.fish
                </a>
              </p>
              <p>
                <span className="contact-label">Modulo di contatto</span>
                <a href="https://www.umibi.fish/contatti" target="_blank" rel="noopener noreferrer" className="contact-link">
                  Apri form di contatto
                </a>
              </p>
            </div>

            <div className="contacts-card contacts-card--full">
              <h3>Chi siamo</h3>
              <p>
                Umibi Italia è la divisione specializzata nella fornitura di pesce fresco e prodotti ittici per ristoranti,
                sushi bar e attività horeca. Ogni giorno selezioniamo, lavoriamo e distribuiamo materie prime di alta qualità,
                pensate per rispondere alle esigenze operative e qualitative dei professionisti della ristorazione.
              </p>
              <p style={{ marginTop: '0.75rem' }}>
                Grazie a una logistica interna strutturata e a una catena del freddo costantemente monitorata, garantiamo
                consegne puntuali, programmate o su richiesta, anche nei periodi di maggiore affluenza.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="home-hero">
          <img src={HeroImage} alt="Umibi Italia" className="home-hero-img" />
          <div className="home-hero-overlay">
            <p className="eyebrow">Umibi Italia</p>
            <h1>Ciao, {userName}</h1>
            <p>Cosa vuoi fare oggi?</p>
          </div>
        </div>

        <nav className="home-nav">
          <button className="home-nav-btn" onClick={() => setSection('new-order')}>
            <span className="home-nav-icon" aria-hidden="true">
              <OrderIcon />
            </span>
            <span className="home-nav-label">Nuovo Ordine</span>
            <span className="home-nav-sub">Inserisci un nuovo ordine</span>
          </button>
          <button className="home-nav-btn" onClick={() => setSection('history')}>
            <span className="home-nav-icon" aria-hidden="true">
              <HistoryIcon />
            </span>
            <span className="home-nav-label">Storico</span>
            <span className="home-nav-sub">Consulta gli ordini passati</span>
          </button>
          <button className="home-nav-btn" onClick={() => setSection('contacts')}>
            <span className="home-nav-icon" aria-hidden="true">
              <ContactsIcon />
            </span>
            <span className="home-nav-label">Contatti</span>
            <span className="home-nav-sub">Assistenza e informazioni</span>
          </button>
        </nav>
      </>
    )
  }

  return (
    <div className="app-shell">
      <SignedIn>
        <div className="home-shell">
          <header className="home-header">
            <img className="home-logo" src={LogoImage} alt="Logo Umibi Italia" />
            <div className="home-header-actions">
              {isAdmin && (
                <button
                  className={`cart-top-button admin-top-button${section === 'admin' ? ' admin-top-button--active' : ''}`}
                  onClick={() => setSection('admin')}
                  aria-label="Pannello Admin"
                  title="Pannello Admin"
                >
                  <AdminIcon />
                </button>
              )}
              <button className="cart-top-button" onClick={() => setSection('cart')} aria-label="Apri carrello">
                <CartIcon />
                {cartItems.length ? <span className="cart-top-badge">{cartItems.length}</span> : null}
              </button>
              <UserButton afterSignOutUrl="/" />
              <button className="ghost-button home-logout" onClick={() => void signOut()}>
                Esci
              </button>
            </div>
          </header>

          {renderSignedInContent()}
        </div>
      </SignedIn>

      <SignedOut>
        <div className="hero-panel">
          <div className="hero-copy">
            <img className="brand-logo" src={LogoImage} alt="Logo Umibi Italia" />
            <p className="eyebrow">Umibi Italia</p>
            <h1>Benvenuto in Umibi Italia</h1>
            <p>
              Accedi o registrati per gestire i tuoi ordini e ricevere assistenza personalizzata.
            </p>
            <div className="hero-cta">
              <button className="ghost-button" onClick={() => openAuthMode('login')}>
                Login
              </button>
              <button className="ghost-button" onClick={() => openAuthMode('register')}>
                Registrati
              </button>
            </div>
          </div>
          <div className="hero-image">
            <img src={HeroImage} alt="Foto Umibi Italia" />
          </div>
        </div>

        <main className="form-card" ref={authCardRef}>
          <div className="form-header">
            <div>
              <span className="form-label">Account</span>
              <h2>
                {mode === 'login'
                  ? 'Accedi al tuo account'
                  : mode === 'register'
                    ? 'Crea il tuo account'
                    : mode === 'forgot'
                      ? 'Recupera la password'
                      : 'Imposta una nuova password'}
              </h2>
            </div>
            <button className="toggle-button" onClick={() => openAuthMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Passa a Registrazione' : 'Vai al Login'}
            </button>
          </div>

          {mode === 'login' ? (
            <>
              <SignIn
                appearance={clerkAppearance}
                routing="virtual"
                signUpUrl="#register"
                fallbackRedirectUrl="/"
              />
              <div className="forgot-link-wrap">
                <button
                  className="ghost-button forgot-link-btn"
                  onClick={() => { openAuthMode('forgot'); setFpError(''); setFpEmail('') }}
                >
                  Password dimenticata?
                </button>
              </div>
            </>
          ) : mode === 'register' ? (
            <SignUp
              appearance={clerkAppearance}
              routing="virtual"
              signInUrl="#login"
              fallbackRedirectUrl="/"
            />
          ) : mode === 'forgot' ? (
            <div className="fp-form">
              <p className="fp-note">Inserisci la tua email per ricevere il codice di reset.</p>
              <input
                className="qty-input fp-input"
                type="email"
                name="reset_email"
                autoComplete="email"
                placeholder="Email"
                value={fpEmail}
                onChange={e => setFpEmail(e.target.value)}
                disabled={fpLoading}
              />
              {fpError && <p className="fp-error">{fpError}</p>}
              <div className="fp-inline-actions">
                <button className="submit-button" onClick={() => void sendForgotCode()} disabled={fpLoading || !fpEmail}>
                  {fpLoading ? 'Invio...' : 'Invia codice'}
                </button>
                <button className="ghost-button" onClick={() => setMode('login')}>Annulla</button>
              </div>
            </div>
          ) : (
            <div className="fp-form">
              <p className="fp-note">Controlla la tua email e inserisci il codice ricevuto.</p>
              <p className="fp-hint">
                Email: {fpEmail}
              </p>
              <label className="fp-label" htmlFor="reset-code">
                Codice ricevuto via email
              </label>
              <input
                id="reset-code"
                className="qty-input fp-input"
                type="text"
                name="reset_code"
                autoComplete="one-time-code"
                placeholder="Codice ricevuto via email"
                value={fpCode}
                onChange={e => setFpCode(e.target.value)}
                disabled={fpLoading}
              />
              <label className="fp-label" htmlFor="new-password">
                Nuova password
              </label>
              <input
                id="new-password"
                className="qty-input fp-input"
                type="password"
                name="new_password"
                autoComplete="new-password"
                placeholder="Nuova password"
                value={fpPassword}
                onChange={e => setFpPassword(e.target.value)}
                disabled={fpLoading}
              />
              {fpError && <p className="fp-error">{fpError}</p>}
              <div className="fp-inline-actions">
                <button className="submit-button" onClick={() => void sendResetPassword()} disabled={fpLoading || !fpCode || !fpPassword}>
                  {fpLoading ? 'Salvataggio...' : 'Reimposta password'}
                </button>
                <button className="ghost-button" onClick={() => setMode('login')}>Annulla</button>
              </div>
            </div>
          )}
        </main>
      </SignedOut>
    </div>
  )
}

export default App
