import { createClerkClient, verifyToken } from '@clerk/backend'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const ADMIN_EMAILS = [
  'alessandra.gruosso@alma-studiomarketing.com',
  'marco.gerli@ssisrl.net',
  'alessandra.gruosso@outlook.it'
]

type FirebaseTokenRequest = {
  authorization?: string
  origin?: string
}

function getAuthorizedParties() {
  const value = process.env.CLERK_AUTHORIZED_PARTIES?.trim()

  if (!value) {
    return undefined
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function getFirebaseAdminApp() {
  const apps = getApps()
  if (apps.length) {
    return apps[0]
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!rawServiceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON non configurato.')
  }

  const serviceAccount = JSON.parse(rawServiceAccount) as Parameters<typeof cert>[0]

  return initializeApp({
    credential: cert(serviceAccount)
  })
}

function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  }
}

export async function buildFirebaseTokenResponse(request: FirebaseTokenRequest) {
  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (!clerkSecretKey) {
      return jsonResponse(500, { error: 'CLERK_SECRET_KEY non configurato.' })
    }

    const bearerToken = request.authorization?.replace(/^Bearer\s+/i, '')?.trim()
    if (!bearerToken) {
      return jsonResponse(401, { error: 'Token Clerk mancante.' })
    }

    const verifiedToken = await verifyToken(bearerToken, {
      secretKey: clerkSecretKey,
      authorizedParties: getAuthorizedParties()
    })

    const clerkClient = createClerkClient({ secretKey: clerkSecretKey })
    const clerkUser = await clerkClient.users.getUser(verifiedToken.sub)
    const primaryEmail = clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
    const clerkEmail = primaryEmail?.emailAddress ?? ''
    const clerkRole = ADMIN_EMAILS.includes(clerkEmail) ? 'admin' : 'customer'

    const firebaseAuth = getAuth(getFirebaseAdminApp())
    const firebaseUid = `clerk_${clerkUser.id}`
    const firebaseToken = await firebaseAuth.createCustomToken(firebaseUid, {
      clerkUserId: clerkUser.id,
      clerkEmail,
      clerkRole
    })

    return jsonResponse(200, {
      firebaseToken,
      firebaseUid,
      clerkUserId: clerkUser.id,
      clerkEmail,
      clerkRole,
      origin: request.origin ?? null
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto.'
    return jsonResponse(401, { error: message })
  }
}