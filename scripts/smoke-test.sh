#!/usr/bin/env bash
# Smoke test E2E: bootstrap superadmin, parejas, multi-polla y aislamiento.
# Corre contra el servidor de smoke (puerto 3100, DB desechable).
set -u
BASE="http://localhost:3100"
SUPER_JAR="/tmp/polla-super.txt"
A_JAR="/tmp/polla-a.txt"
B_JAR="/tmp/polla-b.txt"
BOSS_JAR="/tmp/polla-boss.txt"
EMP_JAR="/tmp/polla-emp.txt"
rm -f "$SUPER_JAR" "$A_JAR" "$B_JAR" "$BOSS_JAR" "$EMP_JAR" /tmp/polla-nojar*.txt
fail=0

step() { echo; echo "── $1"; }
post() { local jar="$1" url="$2" data="$3"; curl -s -b "$jar" -c "$jar" -X POST "$BASE$url" -H 'Content-Type: application/json' -d "$data"; }
getcode() { echo "$1" | grep -o '"\(code\|adminCode\)":"[A-Z2-9]*"' | head -1 | cut -d'"' -f4; }

step "1. Esperando servidor"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login" || true)
  if [ "$code" = "200" ]; then echo "Servidor arriba"; break; fi
  sleep 1
  if [ "$i" = "30" ]; then echo "FAIL: servidor no responde"; exit 1; fi
done

step "2. Bootstrap: primera cuenta = superadmin"
out=$(post "$SUPER_JAR" /api/auth/register '{"username":"harold","displayName":"Harold","pin":"1234"}')
echo "$out"
echo "$out" | grep -q '"ok":true' || { echo "FAIL bootstrap"; fail=1; }

step "3. Registro sin código falla"
out=$(post /tmp/polla-nojar1.txt /api/auth/register '{"username":"colado","displayName":"Colado","pin":"1234"}')
echo "$out" | grep -qi 'invitaci' || { echo "FAIL: dejó entrar sin código"; fail=1; }

step "4. Sync del fixture (superadmin)"
out=$(post "$SUPER_JAR" /api/admin/sync '{}')
echo "$out" | head -c 120; echo
echo "$out" | grep -q '"ok":true' || echo "WARN: sync falló"

step "4b. El catálogo de jugadores se descargó de ESPN"
html=$(curl -s -b "$SUPER_JAR" "$BASE/premios")
options=$(echo "$html" | grep -o '<option value="[^"]*·' | wc -l)
echo "Jugadores en el buscador: $options"
[ "$options" -gt 1000 ] && echo "Catálogo OK ✓" || { echo "WARN: catálogo corto ($options)"; }
echo "$html" | grep -qi 'datalist' && echo "Datalist presente ✓" || { echo "FAIL: sin datalist"; fail=1; }

step "4c. Banderas para (casi) todos los equipos"
html=$(curl -s -b "$SUPER_JAR" "$BASE/partidos?filtro=all")
flags=$(echo "$html" | grep -o '<img[^>]*crest\|<img[^>]*espncdn' | wc -l)
echo "Banderas renderizadas: $flags"
[ "$flags" -gt 120 ] && echo "Banderas OK ✓" || echo "WARN: pocas banderas ($flags)"

step "5. Pareja en la polla del superadmin"
out=$(post "$SUPER_JAR" /api/admin/invites '{"action":"create","kind":"PAIR","label":"Los primos"}')
PAIR_CODE=$(getcode "$out")
echo "Código pareja: $PAIR_CODE"
post "$A_JAR" /api/auth/register "{\"username\":\"juan\",\"displayName\":\"Juan\",\"pin\":\"1111\",\"inviteCode\":\"$PAIR_CODE\",\"pairName\":\"Los Cracks\"}" | grep -q '"ok":true' || { echo "FAIL miembro A"; fail=1; }
post "$B_JAR" /api/auth/register "{\"username\":\"caro\",\"displayName\":\"Caro\",\"pin\":\"2222\",\"inviteCode\":\"$PAIR_CODE\"}" | grep -q '"ok":true' || { echo "FAIL miembro B"; fail=1; }
echo "Pareja registrada ✓"

step "6. Superadmin crea otra polla con su link de admin"
out=$(post "$SUPER_JAR" /api/admin/pollas '{"name":"Polla Oficina"}')
echo "$out"
ADMIN_CODE=$(getcode "$out")
[ -n "$ADMIN_CODE" ] || { echo "FAIL: sin adminCode"; fail=1; ADMIN_CODE="XXXXXXXX"; }

step "7. La landing del código de admin avisa que administrarás"
curl -s "$BASE/invitacion/$ADMIN_CODE" | grep -qi 'administrar' && echo "Landing admin OK" || { echo "FAIL landing admin"; fail=1; }

step "8. La Jefa entra con el código y queda al mando de Polla Oficina"
out=$(post "$BOSS_JAR" /api/auth/register "{\"username\":\"jefa\",\"displayName\":\"La Jefa\",\"pin\":\"5555\",\"inviteCode\":\"$ADMIN_CODE\"}")
echo "$out"
echo "$out" | grep -q '"ok":true' || { echo "FAIL jefa"; fail=1; }

step "9. La Jefa invita gente a SU polla"
out=$(post "$BOSS_JAR" /api/admin/invites '{"action":"create","kind":"INDIVIDUAL","label":"Compañero"}')
EMP_CODE=$(getcode "$out")
echo "Código: $EMP_CODE"
post "$EMP_JAR" /api/auth/register "{\"username\":\"empleado\",\"displayName\":\"Empleado\",\"pin\":\"6666\",\"inviteCode\":\"$EMP_CODE\"}" | grep -q '"ok":true' && echo "Empleado dentro ✓" || { echo "FAIL empleado"; fail=1; }

step "10. Aislamiento de tablas"
html_super=$(curl -s -b "$SUPER_JAR" "$BASE/posiciones")
echo "$html_super" | grep -q 'Los Cracks' && echo "Polla 1 ve a Los Cracks ✓" || { echo "FAIL"; fail=1; }
echo "$html_super" | grep -q 'La Jefa' && { echo "FAIL: polla 1 ve gente de polla 2"; fail=1; } || echo "Polla 1 NO ve a La Jefa ✓"
html_boss=$(curl -s -b "$BOSS_JAR" "$BASE/posiciones")
echo "$html_boss" | grep -q 'Empleado' && echo "Polla 2 ve a Empleado ✓" || { echo "FAIL"; fail=1; }
echo "$html_boss" | grep -q 'Los Cracks' && { echo "FAIL: polla 2 ve gente de polla 1"; fail=1; } || echo "Polla 2 NO ve a Los Cracks ✓"

step "11. El superadmin cruza pollas con ?polla=2; la Jefa no puede"
curl -s -b "$SUPER_JAR" "$BASE/posiciones?polla=2" | grep -q 'La Jefa' && echo "Superadmin ve polla 2 ✓" || { echo "FAIL cross-view"; fail=1; }
curl -s -b "$BOSS_JAR" "$BASE/posiciones?polla=1" | grep -q 'Los Cracks' && { echo "FAIL: la jefa espió la polla 1"; fail=1; } || echo "La Jefa no puede espiar la polla 1 ✓"

step "11b. El superadmin se une a Polla Oficina y juega en ambas"
out=$(post "$SUPER_JAR" /api/memberships '{"action":"join-polla","pollaId":2}')
echo "$out"
echo "$out" | grep -q '"ok":true' || { echo "FAIL join-polla"; fail=1; }
# Su polla activa ahora es Oficina: la tabla debe mostrarlo
curl -s -b "$SUPER_JAR" "$BASE/posiciones" | grep -q 'Harold' && echo "Harold aparece en Polla Oficina ✓" || { echo "FAIL: Harold no está en oficina"; fail=1; }
# Repetir debe fallar
out=$(post "$SUPER_JAR" /api/memberships '{"action":"join-polla","pollaId":2}')
echo "$out" | grep -q '"ok":false' && echo "No se puede unir dos veces ✓" || { echo "FAIL doble join"; fail=1; }
# La Jefa NO puede unirse directo (no es superadmin)
out=$(post "$BOSS_JAR" /api/memberships '{"action":"join-polla","pollaId":1}')
echo "$out" | grep -q '"ok":false' && echo "Jefa sin join directo ✓" || { echo "FAIL guard join"; fail=1; }
# Harold vuelve a su polla original (entry 1 es la del bootstrap)
out=$(post "$SUPER_JAR" /api/memberships '{"action":"switch","entryId":1}')
echo "$out" | grep -q '"pollaId":1' && echo "Switch de regreso ✓" || { echo "FAIL switch"; fail=1; }

step "12. La Jefa NO puede tocar el torneo (sync = solo superadmin)"
code=$(curl -s -b "$BOSS_JAR" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/sync")
echo "POST /api/admin/sync como jefa → $code"
[ "$code" = "403" ] && echo "Guard OK ✓" || { echo "FAIL guard"; fail=1; }

step "13. Branding y páginas clave"
curl -s "$BASE/login" | grep -q 'Polla' && echo "Login OK"
for path in /partidos /premios /posiciones /reglas /admin; do
  code=$(curl -s -b "$SUPER_JAR" -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "GET $path → $code"
  [ "$code" = "200" ] || fail=1
done
# La jefa también ve su panel de admin (de SU polla)
code=$(curl -s -b "$BOSS_JAR" -o /dev/null -w '%{http_code}' "$BASE/admin")
echo "GET /admin como jefa → $code"
[ "$code" = "200" ] || fail=1

echo
if [ "$fail" = "0" ]; then echo "SMOKE_OK"; else echo "SMOKE_FAIL"; exit 1; fi
