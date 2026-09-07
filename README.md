# Sparagnare

App di bilancio con entrate, uscite fisse ricorrenti e uscite variabili,
in portafogli personali o condivisi. Costruita con **Next.js 14 (App Router)**
e **Supabase** (database Postgres + autenticazione + Row Level Security).
Installabile come PWA su telefono.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → **New project** (gratuito).
2. Una volta pronto, vai su **SQL Editor** ed esegui, **in ordine**:
   - `supabase/migrations/0001_init.sql` → **Run**. Crea le tabelle, le
     policy di sicurezza (RLS) e le automazioni (es. quando ti registri, ti
     crea in automatico un portafoglio "Personale" con le categorie di
     base).
   - `supabase/migrations/0002_shared_visibility_and_wallet_membership.sql`
     → **Run**. Aggiunge: la visibilità di nome/email tra i membri di uno
     stesso portafoglio condiviso (senza questa migration la lista
     "Persone con accesso" risulta vuota per chiunque non sia se stesso),
     la possibilità per un membro non proprietario di uscire da un
     portafoglio condiviso, e il vincolo che impedisce due categorie con
     lo stesso nome nello stesso portafoglio.
3. Vai su **Project Settings → API** e copia:
   - `Project URL`
   - `anon public key`

## 2. Configura il progetto in locale

```bash
npm install
cp .env.local.example .env.local
# incolla Project URL e anon key in .env.local
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) → verrai mandato a
`/login`. Registrati con email e password (Supabase, di default, invia
un'email di conferma — controlla su **Authentication → Users** nel
pannello Supabase se vuoi confermare l'utente manualmente durante i test,
oppure disattiva "Confirm email" in **Authentication → Providers → Email**
per velocizzare lo sviluppo).

## 3. Deploy gratuito

1. Crea un repository su GitHub con questo codice.
2. Vai su [vercel.com](https://vercel.com) → **Add New Project** → importa
   il repo.
3. In **Environment Variables** aggiungi le stesse due variabili di
   `.env.local`.
4. Deploy. Otterrai un indirizzo tipo `tuoprogetto.vercel.app`, gratuito e
   con HTTPS incluso.

Su Supabase, in **Authentication → URL Configuration**, aggiorna
`Site URL` e `Redirect URLs` con l'indirizzo Vercel (altrimenti i link di
conferma email punteranno a `localhost`).

## Come funziona

- **Portafogli**: ognuno ha un portafoglio "Personale" creato in automatico
  alla registrazione. Da "+ Portafoglio" se ne possono creare altri
  condivisi.
- **Condivisione**: solo il proprietario di un portafoglio condiviso può
  invitare altre persone, inserendo la loro email — devono già avere un
  account sull'app. L'accesso è protetto da Row Level Security: chi non è
  stato invitato non vede nulla di quel portafoglio, a differenza del
  prototipo iniziale (dove "condiviso" significava visibile a chiunque
  avesse il link). Dalla scheda "Persone con accesso" il proprietario può
  rimuovere un membro o eliminare l'intero portafoglio; un membro non
  proprietario può uscirne in autonomia.
- **Voci ricorrenti**: attivando "Si ripete ogni mese" su un'entrata o
  un'uscita, questa viene conteggiata automaticamente in ogni mese
  successivo. L'icona ⏸ su una voce ricorrente permette di interromperla a
  partire dal mese visualizzato (imposta `recurring_end_date` invece di
  cancellare la voce, così lo storico resta intatto).
- **Andamento mensile**: subito sopra le liste di entrate/uscite, un
  grafico mostra il confronto tra entrate e uscite negli ultimi 6 mesi
  (con vista tabellare alternativa per l'accessibilità).
- **PWA**: l'app ha manifest e service worker, quindi può essere
  "installata" sulla schermata home da telefono o desktop (icona,
  splash screen, avvio a schermo intero). Il service worker mette in
  cache solo la shell statica dell'app, mai le chiamate a Supabase: i
  dati finanziari restano sempre aggiornati in tempo reale.

## Prossimi passi possibili

- Notifiche email quando qualcuno aggiunge una spesa a un portafoglio
  condiviso (richiede un servizio email esterno, es. Resend, con una sua
  API key).
