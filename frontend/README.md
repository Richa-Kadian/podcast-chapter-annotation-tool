# Momento — Frontend

The CE1 website: plain HTML, CSS and JavaScript with no build step. Since CE2 it saves everything through the backend API in `../backend`. See the main [README](../README.md) for the full picture.

## Run

Serve this folder with any static server on port 5500, for example VS Code Live Server, `npx serve . -l 5500`, or `python3 -m http.server 5500`. The backend must be running on port 5050.

## Pointing at a different backend

`js/config.js` is the only file that contains the API address:

```js
const LOCAL_API_URL = 'http://localhost:5050/api';                 // used on localhost
const PRODUCTION_API_URL = 'https://momento-api.onrender.com/api'; // used everywhere else
```

After deploying the backend, change `PRODUCTION_API_URL` if your API URL is different.

## Script order on every page

```html
<script src="js/config.js"></script>  <!-- API base URL -->
<script src="js/api.js"></script>     <!-- window.MomentoApi: request helper + login token -->
<script src="js/common.js"></script>  <!-- window.Momento: shared UI helpers, sign-in state -->
<script src="js/<page>.js"></script>
```
