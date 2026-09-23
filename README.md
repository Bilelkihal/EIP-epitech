# Open Source Readiness — TEK5

Checklist d'ouverture open source pour les EIP. Une équipe remplit le formulaire,
répond **Oui / Non / ?** à 8 points de palier 1 et 36 bonnes pratiques, puis envoie
son audit. Chaque envoi produit :

- un PDF téléchargé par l'étudiant ;
- un e-mail au coach (SMTP, votre compte Gmail), PDF en pièce jointe ;
- **si l'application tourne sur une machine à disque accessible en écriture** —
  votre poste, un VPS, pas Vercel — un fichier Markdown dans
  `submissions/<AAAA-MM-JJ>/<HH-mm-ss>_<equipe>.md` et une ligne dans
  `submissions/index.csv`. Voir « Déploiement Vercel ».

Les réponses sont aussi gardées dans le `localStorage` du navigateur : une page
rouverte est pré-remplie. Envoyez le lien deux fois (jeudi puis vendredi) — c'est
l'horodatage de chaque envoi qui distingue les deux jours, il n'y a qu'un
formulaire.

## Lancer

```bash
npm install
npm run dev                      # http://localhost:3000
```

En production locale :

```bash
npm run build
npm start                        # http://localhost:3000
```

## Configurer l'e-mail

Les audits partent par SMTP depuis votre propre compte Gmail / Google Workspace.

```bash
cp .env.example .env.local
```

| Variable                 | Rôle                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `SMTP_USER`              | Adresse du compte qui envoie, p. ex. `vous@gmail.com`.                |
| `SMTP_PASSWORD`          | **Mot de passe d'application**, pas le mot de passe du compte.        |
| `SMTP_HOST`              | `smtp.gmail.com` par défaut. Autre fournisseur : mettez son serveur.  |
| `SMTP_PORT`              | `465` (TLS implicite) par défaut ; `587` bascule en STARTTLS.         |
| `SUBMISSIONS_EMAIL_TO`   | Destinataire des audits. Plusieurs adresses séparées par `,`.         |
| `SUBMISSIONS_EMAIL_FROM` | Expéditeur affiché. Défaut : `OSS Checklist <SMTP_USER>`.             |

### Obtenir un mot de passe d'application Google

1. Activez la validation en deux étapes : https://myaccount.google.com/signinoptions/twosv
2. Allez sur https://myaccount.google.com/apppasswords
3. Nommez l'application (« OSS Checklist ») et copiez les **16 caractères**.
4. Collez-les dans `SMTP_PASSWORD` (les espaces sont ignorés).

Ce mot de passe ne sert qu'à l'envoi SMTP et se révoque indépendamment, sans
toucher au compte. Le mot de passe du compte Google ne fonctionne pas : Google a
supprimé l'authentification SMTP par mot de passe simple en 2022.

Si les mots de passe d'application sont désactivés par l'administrateur du
domaine (fréquent sur un compte Workspace d'école), aucun envoi SMTP n'est
possible depuis ce compte — utilisez une adresse Gmail personnelle.

Sans `SMTP_USER` ou `SMTP_PASSWORD`, l'application tourne quand même : le fichier
Markdown est écrit et l'étudiant voit une confirmation, seul l'e-mail est ignoré.

Quotas : **500 destinataires par jour** pour un compte Gmail gratuit, 2 000 pour
Google Workspace — largement au-dessus d'une promo qui envoie deux fois.

## Ouvrir à une promo pour la journée

L'application écrit des fichiers : elle doit tourner **sur une vraie machine** —
votre poste, un VPS — et être exposée par un tunnel. Lancez-la d'abord :

```bash
npm run build && npm start       # laisse tourner dans un terminal
```

### ngrok

```bash
brew install ngrok                          # ou https://ngrok.com/download
ngrok config add-authtoken <votre-token>    # une fois, compte gratuit
ngrok http 3000
```

ngrok affiche une URL `https://xxxx-xx-xx-xx-xx.ngrok-free.app` : c'est le lien à
donner à la promo. Elle change à chaque redémarrage d'ngrok — gardez le terminal
ouvert toute la journée.

### Cloudflare Tunnel

```bash
brew install cloudflared                    # ou https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

`cloudflared` affiche une URL `https://xxx-xxx-xxx.trycloudflare.com`. Aucun
compte n'est nécessaire pour un tunnel éphémère. Là aussi l'URL change à chaque
relance.

### Sur le réseau de l'école, sans tunnel

```bash
npm start -- -H 0.0.0.0
```

L'application répond alors sur `http://<votre-ip-locale>:3000` pour les machines
du même réseau. Plus rapide, mais tout le monde doit être sur le même Wi-Fi et
certains réseaux d'école isolent les postes entre eux.

## Déploiement Vercel

L'application tourne sur Vercel, mais **elle n'y écrit aucun fichier**. Le système
de fichiers d'une fonction y est en lecture seule ; seul `/tmp` est accessible en
écriture, il est vidé entre deux invocations et n'est partagé par aucune autre.
Pour un envoi reçu par l'instance hébergée :

| | Vercel | Local + tunnel |
| --- | --- | --- |
| PDF construit et téléchargé par l'étudiant | oui | oui |
| E-mail SMTP avec le PDF en pièce jointe | oui | oui |
| `submissions/<date>/….md` | **non** | oui |
| Ligne dans `submissions/index.csv` | **non** | oui |
| `npm run summary` exploitable | **non** | oui |

L'API répond alors `{"ok":true,"file":null,"emailed":true}` et l'étudiant voit
« Votre audit a été transmis à votre coach » au lieu d'un nom de fichier. Rien ne
plante, rien n'est perdu — mais **votre boîte mail devient le seul registre**.

### Variables d'environnement

`.env.local` n'est pas déployé. Les trois variables doivent exister côté Vercel :

```bash
vercel env add SMTP_USER production
vercel env add SMTP_PASSWORD production
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SUBMISSIONS_EMAIL_TO production
vercel env add SUBMISSIONS_EMAIL_FROM production
```

Gmail accepte les connexions SMTP sortantes depuis une fonction Vercel, mais
Google surveille les connexions venant d'IP de datacenter : un premier envoi peut
être refusé le temps que vous validiez l'activité depuis
https://myaccount.google.com/notifications.

### Garder quand même les fichiers

Lancez l'application localement et exposez-la par un tunnel (section précédente) :
les envois reçus par cette instance-là écrivent bien leurs `.md`. Les deux
déploiements peuvent coexister — c'est l'URL donnée à la promo qui décide.

## Comparer jeudi et vendredi

```bash
npx tsx scripts/summary.ts            # tout l'historique
npx tsx scripts/summary.ts 2026-09-22 # à partir de cette date
npm run summary                       # raccourci
```

```
ÉQUIPE       N   PREMIÈRE       P1     P2   ?   DERNIÈRE       P1     P2   ?   ΔP1   ΔP2
────────────────────────────────────────────────────────────────────────────────────────
Nimbus       2   22/09 18:47   6/8  21/36   4   23/09 16:02   8/8  29/36   1    +2    +8
```

Le script lit les en-têtes YAML des `.md`, regroupe par équipe (insensible à la
casse et aux accents), et compare le premier envoi au dernier.

Il ne voit que les fichiers présents dans `submissions/` — donc **rien de ce qui
est envoyé via l'instance Vercel**, qui n'écrit pas de fichier. Pour comparer
jeudi et vendredi à partir d'envois hébergés, enregistrez les `.md` reçus par
e-mail dans `submissions/<AAAA-MM-JJ>/`, ou faites tourner l'application
localement ce jour-là.

## Modifier la checklist

Tout est dans **`src/data/checklist.json`** — un seul endroit, lu à la fois par la
page et par l'API. Chaque item a un `id` stable (`gate-license`,
`git-gitignore`…) : gardez-le tel quel en réordonnant, sinon les audits déjà
enregistrés ne désignent plus les mêmes questions. Les items `"required": true`
composent le palier 1.

`src/lib/checklist.ts` type ce JSON et détient le calcul des scores, utilisé
par la page **et** recalculé côté serveur à chaque envoi — un score envoyé par le
client n'est jamais cru.

## Les envois sont committés

`submissions/` n'est **pas** dans `.gitignore`, volontairement. Après une journée :

```bash
git add submissions && git commit -m "audits du 22/09"
```
