# Umibi Italia

Portale ordini React + Vite per Umibi Italia.

## Avvio rapido

1. Apri la cartella `Umibi Italia` in VS Code.
2. Copia `.env.example` in `.env.local` e compila le variabili richieste.
3. Esegui `npm install`.
4. Avvia con `npm run dev`.
5. Apri `http://localhost:5173`.

## Variabili richieste

### Client
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Server
- `CLERK_SECRET_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

Le variabili server-side servono al bridge Clerk → Firebase che crea il token custom Firebase dopo il login.

## Sicurezza

- Clerk continua a gestire login, registrazione e sessione utente.
- Firebase Firestore resta il database degli ordini.
- Le regole Firestore sono deny-by-default e accettano solo utenti autenticati.
- Il bridge server traduce la sessione Clerk in un custom token Firebase.

## Deploy Netlify

Il progetto include:
- header di sicurezza in `netlify.toml`
- funzione serverless in `netlify/functions/firebase-token.ts`
- route `/api/firebase-token` per il bridge

## Struttura principale

- `src/App.tsx` - app principale con login, ordini, storico e admin
- `src/lib/firebase.ts` - inizializzazione Firebase client
- `server/firebase-token.ts` - logica condivisa del bridge Clerk/Firebase
- `firestore.rules` - regole Firestore
