# Documento tecnico – Software, servizi e strumenti utilizzati per l’app Umibi Italia

## Panoramica generale

Questo documento riassume in modo chiaro e professionale tutti i software, i servizi online e gli strumenti tecnici necessari per lo sviluppo, il funzionamento e la futura evoluzione dell’app Umibi Italia.

L’obiettivo è avere una visione completa di:
- cosa è già stato utilizzato
- cosa è stato configurato online
- cosa servirà in futuro per il database cloud
- cosa servirà per la pubblicazione su Android e Apple Store

---

## 1. Software installati sul computer

Per sviluppare e gestire l’app sono stati necessari i seguenti software locali.

### Visual Studio Code
Editor di sviluppo utilizzato per:
- scrittura del codice
- modifica dei file del progetto
- test e manutenzione dell’app

### Node.js
Ambiente necessario per eseguire l’app in locale e generare la build finale di produzione.
Con Node.js viene installato anche **npm**, utilizzato per la gestione delle dipendenze del progetto.

### Browser web
Necessario per testare l’app durante lo sviluppo e dopo la pubblicazione online.

Browser consigliati:
- Google Chrome
- Microsoft Edge

---

## 2. Librerie tecniche utilizzate nel progetto

Queste librerie sono parte integrante dell’app e vengono gestite tramite npm.

### React
Libreria principale utilizzata per costruire l’interfaccia utente dell’app.

### React DOM
Serve per visualizzare correttamente l’applicazione nel browser.

### Vite
Strumento di sviluppo usato per:
- avvio rapido del progetto in locale
- compilazione della versione finale da pubblicare

### vite-plugin-pwa
Plugin utilizzato per trasformare la web app in una PWA installabile su smartphone e tablet.

Consente di gestire:
- manifest dell’app
- service worker
- installazione da browser
- cache offline delle risorse principali

### TypeScript
Utilizzato per scrivere codice più robusto, ordinato e controllato.

### Clerk React
Libreria usata per la gestione dell’autenticazione utenti.
Permette:
- login
- registrazione
- gestione sessioni
- recupero password

### Firebase
Libreria e servizi cloud usati per salvare gli ordini nel database Firestore.

Permette:
- salvataggio ordini nel cloud
- storico persistente per utente
- recupero ordini da più dispositivi
- gestione futura del pannello admin e dei dati centralizzati

### xlsx
Libreria usata per generare l’estrazione Excel degli ordini.

Permette:
- esportazione multi-foglio
- foglio ordini completo
- foglio statistiche
- top clienti e prodotti più ordinati

---

## 3. Servizi online configurati

Oltre ai software locali, l’app utilizza alcuni servizi online fondamentali per il suo funzionamento completo.

### Clerk
Servizio utilizzato per la gestione degli utenti e dell’accesso all’app.

Funzioni principali:
- autenticazione
- registrazione utenti
- accesso protetto
- gestione account

### EmailJS
Servizio utilizzato per l’invio automatico delle email collegate agli ordini.

Funzioni principali:
- invio ordine all’azienda
- invio conferma ordine al cliente
- gestione template email

### Netlify
Servizio utilizzato per pubblicare online la demo dell’app e generare un link pubblico accessibile via browser.

### Firebase Firestore
Servizio cloud utilizzato per salvare e leggere gli ordini in modo centralizzato.

Funzioni principali:
- archiviazione ordini
- storico cloud persistente
- lettura ordini per singolo utente
- supporto al pannello admin

### PWA / installazione mobile
La web app è stata configurata come PWA installabile.

Funzioni principali:
- installazione da iPhone e Android
- icona con logo Umibi
- apertura a schermo intero
- aggiornamento automatico tramite service worker

---

## 4. Comandi principali usati durante lo sviluppo

### Avvio ambiente locale

```bash
npm run dev
```

Serve per avviare l’app sul computer in modalità sviluppo.

### Build di produzione

```bash
npm run build
```

Serve per generare la versione finale ottimizzata da pubblicare online.

---

## 5. Riepilogo del necessario già utilizzato

### Software installati sul computer
- Visual Studio Code
- Node.js
- Browser web

### Servizi online configurati
- Clerk
- EmailJS
- Netlify
- Firebase

### Funzioni già implementate nell’app
- pannello admin con ordini, stato e statistiche
- export Excel multi-foglio
- PWA installabile con logo Umibi
- nuove grafiche e nuovi pulsanti dell’interfaccia

---

## 6. Strumenti facoltativi e sviluppi futuri

Questi strumenti non sono obbligatori per la demo attuale, ma risultano molto utili per la crescita del progetto.

### GitHub
Utile per:
- salvare il progetto online
- mantenere uno storico delle modifiche
- collegare eventuali deploy automatici

### Vercel
Alternativa a Netlify per la pubblicazione web dell’app.

### Capacitor
Tecnologia consigliata per trasformare la web app in una vera app mobile installabile su Android e iPhone.

### xlsx
Già utilizzato per l’export Excel degli ordini.

### vite-plugin-pwa
Già utilizzato per la versione PWA installabile.

---

## 7. Database consigliato per lo storico ordini

Attualmente lo storico ordini è gestito in modo locale. Per rendere il sistema più solido e professionale, è consigliata l’integrazione di un database cloud.

### Soluzione consigliata: Firebase
Firebase è consigliato perché consente di:
- salvare lo storico ordini nel cloud
- associare gli ordini al singolo utente
- recuperare i dati da dispositivi diversi
- mantenere uno storico persistente e centralizzato

### Componenti Firebase utili
- **Cloud Firestore** per salvare ordini, utenti e storico
- **Firebase Authentication** opzionale, nel caso in cui in futuro si voglia sostituire o affiancare Clerk
- **Firebase Hosting** opzionale, come alternativa alla pubblicazione su Netlify

### Stato attuale
Firebase Firestore è già stato integrato nel progetto per il salvataggio ordini e la consultazione dello storico.

### Cosa servirà per integrarlo
- creazione di un progetto su Firebase Console
- configurazione del database Firestore
- impostazione delle regole di sicurezza
- generazione delle chiavi di configurazione
- collegamento del frontend React al database

---

## 8. Pubblicazione futura su Android e Apple Store

L’app attuale nasce come web app. Per la pubblicazione sugli store sarà necessario trasformarla in app mobile.

### Tecnologia consigliata per il passaggio mobile
La soluzione più adatta è **Capacitor**, perché permette di riutilizzare l’app web esistente e confezionarla come app mobile per Android e iOS.

### Per la pubblicazione su Android servirà
- Android Studio
- Android SDK
- account Google Play Console
- icona app e schermate di anteprima
- file firmato per la pubblicazione sul Play Store

### Per la pubblicazione su iPhone servirà
- un computer Apple oppure accesso a macOS
- Xcode
- account Apple Developer
- bundle identifier dell’app
- schermate, icone e informazioni sulla privacy
- build firmata per App Store Connect

### Passaggi generali per arrivare sugli store
1. completare e stabilizzare la web app
2. integrare un database cloud come Firebase
3. trasformare l’app tramite Capacitor
4. testare l’app su dispositivi Android e iPhone
5. preparare materiali grafici e documentazione privacy
6. pubblicare sul Play Store e sull’App Store

### Stato attuale
La web app è già installabile come PWA da browser, quindi il passaggio agli store è un’evoluzione successiva e non più un requisito per l’uso quotidiano.

---

## 9. Riassunto esteso finale

### Strumenti già utilizzati nel progetto
- Visual Studio Code
- Node.js
- React
- React DOM
- Vite
- TypeScript
- Clerk
- EmailJS
- Netlify
- Firebase
- xlsx
- vite-plugin-pwa

### Strumenti e servizi da aggiungere in futuro
- GitHub per repository e versionamento
- Capacitor per conversione mobile
- Android Studio per Android
- Xcode per iPhone
- Google Play Console per il Play Store
- Apple Developer per l’App Store

---

## 10. Piani free, piani a pagamento e condizioni dei prodotti utilizzati

> Nota: le informazioni riportate di seguito sono indicative e basate sui piani pubblici consultabili ad aprile 2026. Prezzi, soglie e condizioni possono cambiare nel tempo in base alle politiche ufficiali dei fornitori.

| Prodotto / Servizio | Utilizzo nel progetto | Piano gratuito | Piano a pagamento / condizioni principali |
| --- | --- | --- | --- |
| Visual Studio Code | Sviluppo dell’app | Sì, gratuito | Nessun costo obbligatorio per l’uso base |
| Node.js / npm | Avvio locale e build | Sì, gratuito e open source | Nessun piano a pagamento richiesto |
| React / React DOM | Frontend web | Sì, gratuiti e open source | Nessun piano a pagamento richiesto |
| Vite | Sviluppo e build | Sì, gratuito e open source | Nessun piano a pagamento richiesto |
| TypeScript | Struttura e controllo del codice | Sì, gratuito e open source | Nessun piano a pagamento richiesto |
| Clerk | Login, registrazione e autenticazione | Hobby gratuito con soglia iniziale elevata e funzionalità base di autenticazione | Pro da circa 20 dollari al mese, Business da circa 250 dollari al mese; alcune funzioni avanzate hanno limitazioni o add-on dedicati |
| EmailJS | Invio email ordini | Free con 200 richieste mensili, 2 template e storico limitato | Personal da 9 dollari al mese, Professional da 15 dollari al mese, Business da 40 dollari al mese; se si supera la quota, le richieste smettono di essere elaborate |
| Netlify | Pubblicazione online della demo | Free a 0 dollari con deploy base, SSL e dominio Netlify | Personal da 9 dollari al mese, Pro da 20 dollari per membro al mese; alcune funzioni team avanzate come shared environment variables richiedono piani superiori |
| Firebase | Database cloud futuro per storico ordini | Piano Spark gratuito con quote incluse per Firestore, Authentication, Hosting e altre funzioni | Piano Blaze a consumo, con costo variabile in base a letture, scritture, storage, banda e funzioni utilizzate |
| GitHub | Versionamento futuro del progetto | Free a 0 dollari | Team da 4 dollari per utente al mese, Enterprise da circa 21 dollari per utente al mese |
| Capacitor | Conversione della web app in mobile app | Sì, gratuito e open source | Nessun costo obbligatorio diretto |
| Android Studio | Compilazione app Android | Sì, gratuito | Nessun piano a pagamento richiesto |
| Google Play Console | Pubblicazione su Android Store | Non è previsto un uso completo gratuito per la pubblicazione commerciale | Richiede registrazione account sviluppatore, verifica identità e pagamento della quota di registrazione prevista da Google |
| Xcode | Compilazione app iPhone | Sì, gratuito su macOS | Nessun costo per l’uso locale, ma serve un account Apple Developer per distribuire l’app |
| Apple Developer Program | Pubblicazione su App Store | Account base Apple gratuito per test e strumenti iniziali | Programma sviluppatore a 99 dollari l’anno; piano Enterprise a 299 dollari l’anno per distribuzione interna aziendale |

### Condizioni operative da considerare

#### Clerk
- molto adatto per autenticazione rapida e moderna
- il piano gratuito è sufficiente per demo e primi test
- alcune opzioni più avanzate, come domini satellite e personalizzazioni estese, richiedono piani superiori

#### EmailJS
- ottimo per la demo e per ordini iniziali
- la soglia gratuita è limitata, quindi per volumi maggiori è probabile serva un upgrade
- se si raggiunge il limite mensile, le email non vengono più elaborate fino al rinnovo o all’upgrade del piano

#### Netlify
- molto comodo per pubblicare rapidamente demo e test pubblici
- il piano gratuito va bene per uso iniziale
- alcune funzioni professionali di team e monitoraggio avanzato richiedono piani a pagamento

#### Firebase
- ideale per storicizzare gli ordini in cloud e recuperarli da ogni dispositivo
- il piano gratuito è sufficiente per partire
- con l’aumento degli utenti e delle operazioni il costo cresce in base al consumo reale

#### Store mobili
- per Android e iPhone non basta la web app: serve una conversione mobile e il rispetto delle linee guida degli store
- serviranno privacy policy, schermate ufficiali, dati sviluppatore e test prima della pubblicazione definitiva

---

## Conclusione

L’app Umibi Italia è già funzionante in ambiente web e dispone di un’infrastruttura iniziale completa per autenticazione, invio email e pubblicazione online.

Per una futura evoluzione professionale del progetto, i prossimi passaggi consigliati sono:
- integrazione di Firebase come database cloud
- consolidamento della versione online definitiva
- conversione in app mobile tramite Capacitor
- pubblicazione sugli store ufficiali Android e Apple

