# PVÖL Förråd på Sites

Migrerad från Vercel till Sites. Worker innehåller statiska tillgångar och en proxy med HttpOnly-sessioner till befintlig Supabase. Personliga konton, engångsinbjudningar och all data behålls.

Bygg: `bash scripts/build.sh`. Verifiera: `node scripts/validate-artifact.mjs`, `node tests/frontend.mjs`, `node tests/community-api.mjs` och `node tests/worker.mjs`.

Kalendern har månadsvy, ISO-veckor, svenska helgdagar, namnsdagar och frivilliga födelsedagar utan födelseår. Namnsdagar från Svenska Dagar / Faboul hämtas via servern med cache; `db/namnsdagar.json` innehåller reservdata. Närvaro är tidsatt och visas i en grön/röd medlemslista. Instruktioner nås från varje jobb, telefonlistan från nedre menyn.
