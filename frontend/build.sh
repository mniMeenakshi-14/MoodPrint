# Builds dist/ with esbuild (used when Vite isn't available). `npm run build` does the same with Vite.
set -e
ESB=${ESBUILD:-esbuild}
rm -rf dist && mkdir -p dist/assets && cp public/* dist/
$ESB src/main.jsx --bundle --outfile=dist/assets/app.js --loader:.js=jsx --jsx=automatic --format=iife --minify \
  "--define:import.meta.env.VITE_API_URL=undefined" '--define:process.env.NODE_ENV="production"' --log-level=warning
sed -e 's#<script type="module" src="/src/main.jsx"></script>#<link rel="stylesheet" href="assets/app.css"><script defer src="assets/app.js"></script>#' index.html > dist/index.html
