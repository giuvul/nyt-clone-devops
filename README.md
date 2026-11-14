# The New York Times · Clone, ciclo DevOps completo

**▶ App in produzione: <https://nyt-clone-devops.netlify.app/>** ·
staging: <https://staging--nyt-clone-devops.netlify.app/> ·
[pipeline CI/CD](https://github.com/giuvul/nyt-clone-devops/actions/workflows/ci-cd.yml)

[![CI/CD](https://github.com/giuvul/nyt-clone-devops/actions/workflows/ci-cd.yml/badge.svg?branch=main)](https://github.com/giuvul/nyt-clone-devops/actions/workflows/ci-cd.yml)

Progetto del modulo DevOps del Master in AI e Agenti AI per il Business (Università degli Studi
Guglielmo Marconi). La consegna chiede di prendere un'app sviluppata durante il Master e costruirle
attorno un ciclo DevOps completo: ambiente locale in container, pipeline CI/CD, deploy pubblico
automatico, gestione dei segreti e monitoraggio.

L'app scelta è il **clone della home del New York Times** del modulo React
([repository originale](https://github.com/giuvul/nyt-clone)). Questo repository ne è una copia con
una history nuova, così la versione consegnata per il modulo React resta com'era.

> **Nota sull'uso dell'IA.** Scelte di architettura, ambienti, strumenti e configurazione sono mie.
> Mi sono fatto assistere da un modello linguistico per scrivere parte dei file di configurazione,
> dei test e di questa documentazione, che ho poi rivisto, eseguito e verificato in locale e sulla
> pipeline vera.

![La home su desktop](docs/screenshot-home.jpg)

## Indice

1. [Esplorazione: cosa stiamo deployando](#1-esplorazione-cosa-stiamo-deployando)
2. [Containerizzazione](#2-containerizzazione)
3. [Sicurezza e gestione dei secrets](#3-sicurezza-e-gestione-dei-secrets)
4. [Pipeline CI](#4-pipeline-ci)
5. [Pipeline CD e deploy pubblico](#5-pipeline-cd-e-deploy-pubblico)
6. [Monitoraggio](#6-monitoraggio)
7. [Contenuto del repository](#contenuto-del-repository)
8. [Limiti](#limiti)

---

## 1. Esplorazione: cosa stiamo deployando

### L'app in breve

Una single page app **React 19** (Vite, React Router, Axios, Context API) che riproduce la home del
New York Times con notizie vere: Top Stories nell'ordine della redazione, colonna Opinion, Most
Popular, 23 pagine di sezione, ricerca nell'archivio dal 1851 e articoli salvati nel browser.

Il punto che conta per il deploy: **il browser non chiama mai direttamente il NYT**. Le API del NYT
richiedono una chiave segreta, quindi ogni richiesta passa da un piccolo **proxy lato server**
(`server/nytProxy.js`) che aggiunge la chiave, accetta solo gli endpoint usati dall'app e mette in
cache le risposte (l'API gratuita concede 5 richieste al minuto e 500 al giorno).

```
Browser (React SPA)  ──GET /api/topstories/home──►  proxy (chiave segreta, whitelist, cache)  ──►  api.nytimes.com
       ▲                                                        │
       └──────────────────────── JSON ◄─────────────────────────┘
```

Quindi l'app ha **due componenti**, e ognuna ha bisogno di un posto dove girare in ogni ambiente:

| Componente | Cos'è | Segreti |
| --- | --- | --- |
| **Front end** | file statici (HTML, JS, CSS) prodotti da `vite build` | solo il DSN di Sentry, che è pubblico per natura |
| **Back end** | il proxy: una funzione senza stato, nessun database | `NYT_API_KEY` |

### I tre ambienti

| | Development | Staging | Production |
| --- | --- | --- | --- |
| **Dove** | il mio computer | Netlify, alias `staging` | Netlify, sito principale |
| **URL** | `localhost:5173` (Vite) o `localhost:8080` (Docker) | <https://staging--nyt-clone-devops.netlify.app> | <https://nyt-clone-devops.netlify.app> |
| **Come parte** | `npm run dev` oppure `docker compose up` | automatico a ogni push su `develop` | automatico a ogni push su `main` |
| **Front end** | Vite dev server / nginx in container | CDN Netlify | CDN Netlify |
| **Back end** | middleware di Vite / container `api` | Netlify Function | Netlify Function |
| **Segreti da** | file `.env` (mai committato) | GitHub Secrets | GitHub Secrets |
| **Sentry** | spento (nessun DSN) o `environment=development` | `environment=staging` | `environment=production` |
| **Uptime monitor** | no | no | sì, UptimeRobot ogni 5 minuti |
| **Scopo** | scrivere codice, provare in fretta | vedere la build vera online prima di andare in produzione | gli utenti |

Il flusso di lavoro che ne segue:

```
feature/xyz ──PR──► develop ──(CI verde)──► staging ──PR──► main ──(CI verde)──► production
```

Ogni ambiente usa **lo stesso codice del proxy** (`server/nytProxy.js`): cambia solo il "contenitore"
(middleware Vite, server Node in Docker, Netlify Function). Così quello che provo in locale è quello
che va online.

### Strumenti scelti e perché

| Esigenza | Scelta | Perché |
| --- | --- | --- |
| CI/CD | **GitHub Actions** | Il codice è già su GitHub: niente secondo account né mirror. Minuti gratuiti illimitati per i repository pubblici, *Environments* con URL e secrets separati per staging e production, link diretto alla run da mettere nella consegna. GitLab CI sarebbe equivalente come potenza, ma richiederebbe di spostare o specchiare il repository. |
| Container | **Docker** + **docker compose** | Lo standard; build multi-stage per immagini piccole. |
| Web server del front end | **nginx** (immagine *unprivileged*) | Serve file statici in modo efficiente, fa da reverse proxy verso l'api, gira come utente non root. |
| Deploy | **Netlify** | L'app ha bisogno di un back end per nascondere la chiave. GitHub Pages serve solo file statici, quindi la chiave finirebbe nel browser. Netlify (come Vercel) ha Functions gratuite nello stesso deploy, e il proxy era già scritto per Netlify. Rispetto a Vercel: CDN cache configurabile per risposta (`Netlify-CDN-Cache-Control`), già usata per restare nei limiti dell'API NYT. |
| Linting | **ESLint 10** + `eslint-plugin-react-hooks` | Le regole ufficiali di React verificano che il render sia puro e che gli effetti abbiano le dipendenze giuste. |
| Segreti nel codice | **gitleaks** | Scansiona tutta la history git a ogni push: se un segreto è stato committato, la pipeline si ferma. |
| Error tracking | **Sentry** (piano Developer gratuito) | SDK ufficiale per React 19, raggruppa gli errori uguali, collega ogni errore alla release (commit) e all'ambiente, stack trace leggibili grazie alle source map caricate dalla pipeline. 5.000 errori al mese gratis. |
| Uptime | **UptimeRobot** (piano gratuito) | 50 monitor ogni 5 minuti, alert via email, pagina di stato pubblica. Non richiede di installare nulla. |

### Pianificazione

| Step | Cosa produce | Verifica |
| --- | --- | --- |
| 1. Esplorazione | questo capitolo | — |
| 2. Containerizzazione | `Dockerfile`, `api.Dockerfile`, `nginx.conf`, `docker-compose.yml` | `docker compose up` e app su `localhost:8080` con notizie vere |
| 3. Sicurezza | `.env.example`, `.gitignore`, `.dockerignore`, GitHub Secrets, `scripts/check-dist.sh` | `.env` assente dalla history, gitleaks verde, `***` nei log |
| 4. CI | job `lint`, `test`, `secret-scan`, `docker` | run verde su `main`; run rossa con un errore di lint voluto |
| 5. CD | job `deploy-staging`, `deploy-production` | URL pubblico, controllo post-deploy nella pipeline |
| 6. Monitoraggio | Sentry nel front end, pagina `/debug/sentry`, monitor UptimeRobot | evento di test visibile su Sentry, monitor *Up* |

---

## 2. Containerizzazione

Due immagini, orchestrate da `docker-compose.yml`:

```
                 ┌──────────── docker compose (rete interna) ────────────┐
localhost:8080 ──►  frontend: nginx                                      │
                 │   /          → file statici di React (dist/)          │
                 │   /api/*     → proxy_pass http://api:8787  ──► api    ├──► api.nytimes.com
                 │   /healthz   → "ok"                         node:22   │
                 └───────────────────────────────────────────────────────┘
```

**`Dockerfile` (front end), multi-stage.**
1. `node:22-alpine`: `npm ci` (copiando prima solo `package*.json`, così la cache di Docker evita di
   reinstallare le dipendenze quando cambia solo il codice), poi `npm run build`. Le source map
   vengono cancellate.
2. `nginxinc/nginx-unprivileged:1.29-alpine`: solo `nginx.conf` e la cartella `dist`. Risultato:
   **83 MB**, nessun Node, nessun sorgente, utente `nginx` (uid 101), porta 8080.

**`api.Dockerfile` (back end).** `node:22-alpine` con tre soli file (il server, il proxy, l'elenco
delle sezioni). Il proxy usa solo moduli di Node, quindi niente `npm install`. Gira come utente
`node`. Il file `server/index.js` avvolge il proxy in un server HTTP con un endpoint `/healthz`.

**`nginx.conf`.** Fallback su `index.html` per le rotte di React Router (`/section/world` funziona
anche aprendolo direttamente), inoltro di `/api/` al servizio `api`, cache lunga per i file con hash
nel nome, header di sicurezza, `/healthz`.

**`docker-compose.yml`.** Il servizio `api` non pubblica porte: è raggiungibile solo da `frontend`
sulla rete interna. Il `frontend` parte solo quando l'api è *healthy* (`depends_on` con
`condition: service_healthy`). La chiave arriva da `.env` tramite `env_file`, che è opzionale: senza
`.env` lo stack parte lo stesso (è così che gira nello smoke test della CI).

### Comandi

```bash
cp .env.example .env               # poi scrivi la chiave dopo NYT_API_KEY=
docker compose up --build -d --wait
#   ✔ Container nyt-clone-api-1       Healthy
#   ✔ Container nyt-clone-frontend-1  Healthy
open http://localhost:8080

docker compose ps                  # stato e health check dei due servizi
docker compose logs -f api         # log del proxy: "GET /api/topstories/home 200 479ms"
curl localhost:8080/healthz        # ok
curl localhost:8080/api/topstories/home | head -c 200   # JSON del NYT passato dal proxy
docker compose down                # ferma e rimuove i container
```

Scorciatoie in `package.json`: `npm run docker:up` e `npm run docker:down`.

Verifiche fatte in locale: home, rotta profonda `/section/world` e `/api/topstories/home` rispondono
`200` con notizie vere; `/api/foo` risponde `404` dal proxy; nessuna delle due immagini contiene la
chiave (`docker run --rm nyt-clone-api:local env | grep NYT` → niente) né le source map.

### Sviluppo senza Docker

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173, proxy come middleware di Vite
npm run lint
npm test             # 83 test, senza rete e senza chiave
npm run build
```

Serve [Node.js](https://nodejs.org/) 22.12 o successivo e una chiave gratuita della NYT API: su
[developer.nytimes.com](https://developer.nytimes.com/get-started) crea un'app, attiva *Top
Stories*, *Most Popular* e *Article Search* e copia la **Key**.

---

## 3. Sicurezza e gestione dei secrets

### Dove vive ogni valore

| Variabile | Segreta? | Development | CI/CD | Arriva a |
| --- | --- | --- | --- | --- |
| `NYT_API_KEY` | **sì** | `.env` | GitHub Secret | proxy (Vite / container `api` / Netlify Function) |
| `NETLIFY_AUTH_TOKEN` | **sì** | — | GitHub Secret | Netlify CLI nel job di deploy |
| `NETLIFY_SITE_ID` | poco | — | GitHub Secret | Netlify CLI |
| `SENTRY_AUTH_TOKEN` | **sì** | — | GitHub Secret | `sentry-cli` nel job di deploy (release e source map) |
| `VITE_SENTRY_DSN` | no¹ | `.env` | GitHub Secret | bundle del browser |
| `SENTRY_ORG`, `SENTRY_PROJECT` | no | — | GitHub Variables | `sentry-cli` |

¹ Il DSN di Sentry finisce per forza nel JavaScript pubblico: permette solo di *inviare* eventi. Lo
tengo comunque fuori dal codice, così si cambia senza toccare i sorgenti.

La regola di fondo: **una variabile con prefisso `VITE_` entra nel bundle del browser, una senza
prefisso no.** La chiave NYT non ha il prefisso, quindi Vite non la include mai.

### Le barriere

1. **`.env` mai committato.** È nel `.gitignore` (con `.env.*`, eccetto `.env.example` che ha solo
   i nomi delle variabili). Verifica:
   ```bash
   git check-ignore -v .env          # .gitignore:8:.env   .env
   git log --all --oneline -- .env   # nessun output: .env non è in nessun commit di nessun branch
   ```
2. **`.env` fuori dalle immagini Docker.** È nel `.dockerignore`: non entra nel contesto di build.
   La chiave arriva al container `api` solo a runtime, con `env_file`.
3. **gitleaks a ogni push.** Il job `secret-scan` scansiona tutta la history (`fetch-depth: 0`) con
   `--redact` (se trova qualcosa non stampa il valore) e ricontrolla che `.env` non sia in nessun
   commit.
4. **Controllo dei file pubblici prima del deploy.** `scripts/check-dist.sh` cerca in `dist/` il
   valore della chiave NYT, i nomi delle variabili lato server e le source map: se trova qualcosa,
   il deploy non parte.
5. **Secrets nel repository, non nei file.** In *Settings → Secrets and variables → Actions*; nel
   workflow compaiono solo come `${{ secrets.NOME }}`. I job di deploy usano gli *Environments*
   `staging` e `production` di GitHub.
6. **Nessun secret nei log.** GitHub sostituisce con `***` ogni valore di un secret che compare
   nell'output. In più la pipeline non lo stampa mai: la chiave passa alla Netlify Function con
   `--secret-env` (mascherata anche nell'interfaccia di Netlify) e l'output JSON del deploy finisce
   in un file, non nel log. Il proxy stesso logga solo metodo, percorso e status, mai la query né
   l'URL verso il NYT che contiene la chiave (c'è un test apposta in `tests/apiServer.test.js`).
7. **Permessi minimi.** Il `GITHUB_TOKEN` della pipeline ha solo `contents: read`. I container non
   girano come root. `npm audit --audit-level=high` nella CI.

Per verificare l'assenza di secrets nei log: aprire una run, cercare (lente in alto a destra nei
log) il nome della variabile o le prime lettere del valore: compare solo `***`.

---

## 4. Pipeline CI

File: [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml). Si attiva a ogni **push su
`main`** (e su `develop`), a ogni pull request verso questi branch e a mano (`workflow_dispatch`).

```
lint ─────────┐
test ─────────┼──► docker ──► deploy-staging      (solo push su develop)
secret-scan ──┘          └──► deploy-production   (solo push su main)
```

| Job | Cosa fa | Fallisce se |
| --- | --- | --- |
| **Lint (ESLint)** | `npm run lint` = `eslint . --max-warnings=0` | c'è un errore **o anche un solo warning** |
| **Unit test (Vitest)** | 83 test + `npm audit --audit-level=high` | un test fallisce o c'è una vulnerabilità alta |
| **Secret scan (gitleaks)** | scansione della history + controllo `.env` | trova un segreto |
| **Build containers + smoke test** | `docker compose build`, `up --wait`, `curl` su `/healthz`, `/`, `/section/world`, `/api/…` | un'immagine non si costruisce, un health check non passa, un URL risponde lo status sbagliato |

I primi tre girano in parallelo; il build dei container parte solo se tutti e tre sono verdi, il
deploy solo se anche il build dei container è verde. Una pipeline rossa blocca quindi il codice prima
che arrivi online.

**Fallimento visibile del linting.** Per dimostrarlo ho aggiunto in `src/utils/format.js` una
costante mai usata, `const WEEK = 7 * DAY;`. La prova ha insegnato qualcosa anche a me:

1. [Primo push](https://github.com/giuvul/nyt-clone-devops/actions/runs/43604481312): la pipeline è
   rimasta **verde**. La configurazione di ESLint ignorava le variabili con l'iniziale maiuscola
   (`varsIgnorePattern: "^[A-Z_]"`, un'impostazione comune nei template React per i componenti usati
   solo in JSX), e così ignorava anche le costanti come `WEEK`. ESLint 10 riconosce già l'uso dei
   componenti in JSX, quindi l'eccezione non serviva: l'ho tolta.
2. [Secondo push](https://github.com/giuvul/nyt-clone-devops/actions/runs/43604721923): con la
   regola corretta il job *Lint* diventa **rosso** con l'annotazione
   `'WEEK' is assigned a value but never used` su `src/utils/format.js#6`. Build dei container e
   deploy compaiono come *skipped*: in produzione resta la versione precedente.
3. Terzo push: la costante viene rimossa e la pipeline torna verde, con un nuovo deploy.

Altri dettagli:
- `concurrency`: un nuovo push sullo stesso branch annulla la run vecchia, ma un deploy di
  produzione già partito non viene mai interrotto a metà.
- Cache npm di `actions/setup-node`, versioni delle immagini e della Netlify CLI fissate.
- Il workflow è verificato con [actionlint](https://github.com/rhysd/actionlint).

---

## 5. Pipeline CD e deploy pubblico

I job `deploy-staging` e `deploy-production` fanno la stessa cosa con parametri diversi:

1. `npm ci` e `npm run build` con le variabili dell'ambiente (`VITE_SENTRY_ENVIRONMENT`,
   `VITE_RELEASE` = SHA del commit).
2. `scripts/sentry-sourcemaps.sh`: con `sentry-cli` crea la release su Sentry, inserisce un *debug
   id* in ogni file JS e nella sua mappa, carica le source map, chiude la release e cancella le mappe
   da `dist/`.
3. `scripts/check-dist.sh`: nessun segreto e nessuna source map nei file pubblici.
4. `netlify deploy --no-build --dir=dist --functions=netlify/functions` con `--prod` (production) o
   `--alias=staging` (staging). La chiave NYT passa alla function con `--secret-env`.
5. `scripts/post-deploy-check.sh`: chiama l'URL appena pubblicato e `/api/topstories/home` fino a
   ottenere `200` da entrambi. Se il sito è online ma la function non raggiunge il NYT (chiave
   sbagliata, per esempio) il job diventa rosso.
6. `sentry-cli deploys new`: registra il deploy sulla release, così Sentry sa quando ogni versione è
   andata online e in quale ambiente.

**Source map: un problema trovato e risolto.** All'inizio usavo il plugin ufficiale
`@sentry/vite-plugin`. L'upload riusciva, ma gli stack trace su Sentry puntavano ai file sbagliati
(l'errore di `DebugPage.jsx` risultava in `Axios.js`). Confrontando il JavaScript pubblicato con un
build locale ho visto che il plugin inseriva il suo codice in testa alla riga 1 senza aggiornare le
mappe: con il nuovo bundler di Vite 8 (Rolldown) tutte le colonne della prima riga risultavano
spostate di 415 caratteri. Sono passato a `sentry-cli sourcemaps inject`, che lavora dopo il build e
modifica insieme file e mappe (le mappe iniziano con `;;`, cioè le due righe aggiunte).

L'URL del deploy appare nella pagina della run e in *Environments* del repository.

**Perché la CLI e non l'integrazione git di Netlify.** Il sito Netlify non è collegato al
repository: l'unico modo di pubblicare è la pipeline. Così il deploy avviene **solo dopo** che lint,
test, scansione e build dei container sono verdi, e la CI è l'unica fonte di verità. Con
l'integrazione git Netlify farebbe il build per conto suo, anche con la CI rossa.

**Rollback.** Ogni deploy resta su Netlify: in *Deploys* si sceglie quello precedente e *Publish
deploy* (oppure `git revert` del commit, che ripassa dalla pipeline).

---

## 6. Monitoraggio

### Uptime: UptimeRobot

Monitor HTTP(s) su `https://nyt-clone-devops.netlify.app/` ogni 5 minuti, con alert via email.
Un secondo monitor di tipo *keyword* su `https://nyt-clone-devops.netlify.app/api/topstories/home`
cerca la parola `"status":"OK"` nella risposta: controlla che anche il back end (function + chiave
+ API del NYT) funzioni, non solo che la CDN serva la pagina.

### Errori: Sentry

L'SDK `@sentry/react` parte in `src/main.jsx` prima di React (`src/monitoring/sentry.js`):
- gli errori non gestiti (`window.onerror`, promise rifiutate) arrivano a Sentry da soli;
- gli errori durante il render li intercetta `Sentry.ErrorBoundary`, che mostra una pagina "Something
  went wrong" invece della pagina bianca; gli hook di React 19 (`onUncaughtError`, `onCaughtError`,
  `onRecoverableError`) li inoltrano a Sentry;
- ogni evento porta `environment` (development, staging, production) e `release` (SHA del commit),
  quindi si sa in quale ambiente e da quale deploy arriva;
- `sendDefaultPii: false`: niente IP né dati personali; `tracesSampleRate: 0.1` per restare nel
  piano gratuito.

Senza `VITE_SENTRY_DSN` Sentry resta spento: lo sviluppo e i test non inviano nulla.

### Simulare un errore

La pagina tecnica **[/debug/sentry](https://nyt-clone-devops.netlify.app/debug/sentry)** (non
linkata nel sito) ha due pulsanti:
- **Throw an unhandled error**: lancia un errore fuori da React, come un bug in un callback;
- **Break the page (render error)**: un componente va in errore durante il render; compare la pagina
  di errore e Sentry registra l'evento con lo stack dei componenti.

Entro pochi secondi l'evento compare in *Sentry → Issues*, con ambiente, release, browser e stack
trace leggibile (grazie alle source map caricate dalla pipeline).

### Come interpretare gli alert

| Alert | Cosa significa | Cosa controllare, in ordine |
| --- | --- | --- |
| **UptimeRobot: sito *Down*** (HTTP) | la home non risponde o non risponde `200` | 1. [netlifystatus.com](https://www.netlifystatus.com): problema di Netlify? 2. ultimo deploy in *Netlify → Deploys*: rollback al precedente se è appena cambiato qualcosa. 3. dominio e certificato. |
| **UptimeRobot: keyword *Down*** (API) | il sito è su, ma `/api/topstories/home` non restituisce notizie | 1. *Netlify → Logs → Functions*: errore della function? 2. risposta della function: `429` = limite dell'API NYT (si risolve da solo in un minuto), `502 rejected the server key` = chiave scaduta o revocata → nuova chiave nel GitHub Secret `NYT_API_KEY` e nuovo deploy. 3. stato delle API del NYT. |
| **UptimeRobot: *Up* dopo un *Down*** | il servizio è tornato | durata dell'interruzione nel log del monitor; se è successa più volte, aprire una issue. |
| **Sentry: nuova issue** | un errore mai visto prima | 1. `environment`: production è urgente, staging va risolto prima del merge su main. 2. `release`: se coincide con l'ultimo deploy, l'ha introdotto quel commit → rollback o fix. 3. numero di utenti colpiti e browser: un solo browser vecchio pesa meno di tutti gli utenti. |
| **Sentry: issue *regressed*** | un errore segnato come risolto è tornato | la fix non bastava o un deploy l'ha reintrodotto: confrontare la release. |
| **Sentry: picco di eventi** | molti errori in poco tempo | quasi sempre l'API NYT (rete, limite): controllare il monitor keyword; se è giù anche quello, la causa è il back end, non il front end. |
| **GitHub: pipeline rossa** | il codice non è arrivato online | il job rosso dice dove: lint, test, segreti, container o deploy. Il sito in produzione resta quello dell'ultima run verde. |

Gli eventi con `"Sentry test error"` nel messaggio sono quelli generati da `/debug/sentry`: si possono
ignorare o risolvere.

---

## Contenuto del repository

```
.
├── .github/workflows/ci-cd.yml    pipeline CI/CD (lint, test, secret scan, container, deploy)
├── Dockerfile                     front end: build Node → nginx unprivileged
├── api.Dockerfile                 back end: proxy NYT su Node, senza dipendenze
├── nginx.conf                     SPA fallback, /api → servizio api, /healthz, header di sicurezza
├── docker-compose.yml             ambiente locale: frontend + api
├── .dockerignore / .gitignore     .env e build fuori da immagini e repository
├── .env.example                   variabili necessarie, senza valori
├── eslint.config.js               regole di linting
├── netlify.toml                   redirect della SPA su Netlify
├── netlify/functions/nyt.mjs      Netlify Function: il proxy in produzione
├── server/
│   ├── nytProxy.js                proxy: chiave, endpoint ammessi, cache, errori
│   └── index.js                   server HTTP del proxy per Docker, con /healthz
├── scripts/
│   ├── sentry-sourcemaps.sh       release Sentry, upload e rimozione delle source map
│   ├── check-dist.sh              nessun segreto e nessuna source map nei file pubblici
│   └── post-deploy-check.sh       il sito e l'API rispondono dopo il deploy
├── src/
│   ├── monitoring/sentry.js       inizializzazione di Sentry
│   ├── pages/DebugPage.jsx        /debug/sentry: simulazione degli errori
│   ├── pages/CrashPage.jsx        pagina mostrata dall'ErrorBoundary
│   └── …                          l'app React (api, store, pagine, componenti)
├── tests/                         83 test Vitest (app, proxy, server Docker, Sentry)
└── docs/                          screenshot
```

## Tecnologie

React 19, Vite 8, React Router 8, Axios, Vitest e Testing Library · ESLint 10 · Docker, docker
compose, nginx · GitHub Actions, gitleaks, actionlint · Netlify (CDN e Functions) · Sentry ·
UptimeRobot.

## Limiti

- **Staging e production condividono la chiave NYT** e quindi il limite di 500 richieste al giorno.
  Con un team servirebbe una seconda chiave per lo staging.
- **Lo staging è un alias, non un sito separato**: stessa configurazione Netlify della produzione.
  Va bene per un progetto singolo; con più persone userei un sito Netlify dedicato o i deploy preview
  per ogni pull request.
- **Le immagini Docker non vengono pubblicate** su un registry: servono per lo sviluppo locale e
  vengono costruite e provate nella CI, ma la produzione usa la CDN e le Functions di Netlify, che non
  eseguono container.
- **UptimeRobot gratuito** controlla ogni 5 minuti: un'interruzione più breve può sfuggire.
- La protezione del branch `main` (merge solo con CI verde) è consigliata ma va attivata a mano nelle
  impostazioni di GitHub.

## Autore

**Giuseppe Vulduraro** · [giuseppevulduraro.com](https://giuseppevulduraro.com/) ·
[GitHub](https://github.com/giuvul)
