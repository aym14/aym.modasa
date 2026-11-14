# GitHub Pages deployment

Website: https://aym14.github.io/aym.modasa/

Repository: https://github.com/aym14/aym.modasa

GitHub Actions workflow `main` branch પર push થતાં પહેલા `tools/healthcheck.cjs` અને `tools/edge-functions.test.mjs` ચલાવે છે, પછી `site/` publish કરે છે. `.github/workflows/pages.yml` જ આ deployment configuration છે. Pagesનું URL ઉપર આપેલું છે.

Website ફેરફાર માટે `site/` update કરો. Supabase Edge Function source `supabase/functions/`માં રહે છે, પરંતુ GitHub Pages workflow તેને Supabase projectમાં deploy કરતું નથી; તે માટે Supabase CLIથી અલગ deploy જરૂરી છે. Database migrations પણ અલગથી સંભાળવાના છે; પહેલેથી લાગુ થયેલી migration ફાઇલો બદલશો નહીં.

Supabase migrations, organization Admin membership અને OTP/SMS gateway configuration અલગથી કરવાના રહે છે. Hosting deployment database configuration કરતું નથી.
