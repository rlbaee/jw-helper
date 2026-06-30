# JW Helper

Rakendus assignment-tabelite (ülesannete jaotuse) genereerimiseks koosolekutele.

## Mis see on

- **Inimesed** (`index.html`) — sisesta vennad, nende rollid (Heli, U.teenind., S.teenind., Lugeja, Juhataja, mikr.1+lava, mikr.2) ja mittesaadavad kuupäevad.
- **Ajakava** (`schedule.html`) — vali kuu ja koosoleku nädalapäev(ad), näe kohe eelvaadet tabelist, salvesta ja prindi/eksperdi PDF-iks.
- Kõik andmed on **ühes ühises serveripoolses andmebaasis** (`data/people.json`, `data/schedules.json`) — mitte brauseri localStorage'is. See tähendab, et sina sisestad inimesed ja kõik, kes lehte avavad, näevad sama andmestikku.

## Kuidas käivitada lokaalselt

Vaja on [Node.js](https://nodejs.org) (versioon 18+).

```bash
npm install
npm start
```

Seejärel ava brauseris: `http://localhost:3000`

## Kuidas tasakaalustamine töötab

Ajakava genereerimisel:
1. Leitakse kõik valitud nädalapäeva(de) kuupäevad valitud kuus.
2. Iga rolli jaoks valitakse iga koosoleku jaoks inimene, kellel on see roll, kes pole sel kuupäeval märgitud mittesaadavaks, ja kes pole samal päeval juba mõnda teist rolli täitmas.
3. Eelistatakse inimest, kellel on selle rolli täitmiste arv kõige väiksem (nii jaotub koormus võrdsemalt).
4. **"Salvesta ajakava"** kirjutab täitmiste arvud `people.json` faili tagasi — nii jääb tasakaal meeles ka järgmiste kuude genereerimisel. **"Näita eelvaadet"** ei muuda midagi, seda saab vabalt korduvalt vajutada.

Kui mõnele rollile ei leita sobivat (saadaval olevat) inimest, näitab tabel selles lahtris "—".

## Deployment

Plaanis oli kasutada Vercelit, aga oluline tehniline täpsustus: Vercel (ja teised "serverless" platvormid) ei säilita faile kettal — iga päring võib käivituda uues, tühjas keskkonnas, mistõttu `data/*.json` failidesse kirjutamine **ei püsiks** seal.

See rakendus on ehitatud tavalise Node/Express serverina, mis **vajab püsivat kettaga hostingut**, näiteks:
- **Railway** (railway.app) — tasuta tase, lihtne `git push` deploy, ketas püsib alles
- **Render** (render.com) — sarnane, tasuta tase olemas
- Oma VPS / koduserver

Kui soovid kindlasti Vercelit kasutada, on järgmine samm asendada JSON-failid päris andmebaasiga (nt Vercel Postgres või Vercel KV) — see on lisatöö, aga struktuur (`server.js` API kihiga) on selleks juba valmis ette valmistatud, kuna `readPeople`/`writePeople` funktsioonid on ühes kohas vahetatavad.

## Failistruktuur

```
jw-helper/
├── server.js              # Express server + API + ajakava algoritm
├── package.json
├── data/
│   ├── people.json         # ühine andmebaas: inimesed, rollid, mittesaadavus
│   └── schedules.json       # salvestatud kuu ajakavad
└── public/
    ├── index.html           # inimeste haldus
    ├── schedule.html         # ajakava genereerimine + eelvaade + print
    └── style.css
```
