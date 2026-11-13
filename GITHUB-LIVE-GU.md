# GitHub Pages deployment

Website: https://aym14.github.io/aym.modasa/

Repository: https://github.com/aym14/aym.modasa

GitHub Pages `main` branchના root પરથી publish થાય છે. આ repositoryમાં `site/`ની અંદરની ફાઇલો સીધી rootમાં upload કરી છે અને icons `icons/`માં છે. સ્થાનિક packageનો `site/` folder જ website source છે.

Update કરતી વખતે `site/`ની સુધારેલી ફાઇલો repository rootમાં મૂકો. દરેક commit પછી GitHubનો pages-build-deployment workflow ફરી ચાલે છે. સ્થાનિક `.github/workflows/pages.yml` આખા packageને repositoryમાં રાખવા માટેનું વૈકલ્પિક layout છે; તે હાલના root deploymentમાં upload કરેલું નથી.

Supabase migrations, organization Admin membership અને OTP/SMS gateway configuration અલગથી કરવાના રહે છે. Hosting deployment database configuration કરતું નથી.
