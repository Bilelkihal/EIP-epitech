# Open Source Readiness — TEK5

Checklist d'ouverture open source pour les EIP. Une équipe remplit le formulaire,
répond **Oui / Non / ?** à 8 points de palier 1 et 36 bonnes pratiques, puis envoie
son audit. Chaque envoi produit :

- un fichier Markdown dans `submissions/<AAAA-MM-JJ>/<HH-mm-ss>_<equipe>.md` ;
- une ligne dans `submissions/index.csv` ;
- un PDF téléchargé par l'étudiant ;
- un e-mail au coach, PDF en pièce jointe.

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

```bash
cp .env.example .env.local
```

| Variable                 | Rôle                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `RESEND_API_KEY`         | Clé API Resend (https://resend.com/api-keys).                      |
| `SUBMISSIONS_EMAIL_TO`   | Destinataire des audits. Plusieurs adresses séparées par `,`.      |
| `SUBMISSIONS_EMAIL_FROM` | Expéditeur. Défaut : `OSS Checklist <onboarding@resend.dev>`.      |

`onboarding@resend.dev` fonctionne sans configuration mais **ne délivre qu'à
l'adresse propriétaire du compte Resend**. Pour écrire ailleurs, vérifiez un
domaine dans Resend et mettez-le dans `SUBMISSIONS_EMAIL_FROM`.

Sans `RESEND_API_KEY`, l'application tourne quand même : le fichier Markdown est
écrit et l'étudiant voit une confirmation, seul l'e-mail est ignoré.

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

## Pourquoi pas Vercel

**Les envois ne peuvent pas être écrits en fichiers sur Vercel.** Le système de
fichiers d'une fonction y est en lecture seule ; seul `/tmp` est accessible en
écriture, il est vidé entre deux invocations et n'est partagé par aucune autre.
Un déploiement Vercel ne créerait donc jamais `submissions/<date>/….md`, et rien
ne serait committé dans ce dépôt.

Si vous déployez quand même (Vercel, Netlify, Cloud Run…), l'application ne
plante pas : l'écriture est ignorée, l'e-mail Resend part, et c'est votre boîte
mail qui devient le seul registre. `npm run summary` n'a alors rien à lire — sauf
si vous enregistrez vous-même les pièces jointes dans `submissions/`.

Pour un séminaire d'une journée, le tunnel ci-dessus est plus simple et garde les
fichiers dans le dépôt.

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
