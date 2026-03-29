#!/bin/bash
API="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0

test_it() {
  TOTAL=$((TOTAL+1))
  local name="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    PASS=$((PASS+1))
    echo "  [PASS] $name"
  else
    FAIL=$((FAIL+1))
    echo "  [FAIL] $name"
  fi
}

echo ""
echo "======================================"
echo "  KYROO Smoke Test"
echo "======================================"
echo ""

# 1. Server health
echo "--- Server & Database ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API)
test_it "Server responds (HTTP 200)" "$([ "$STATUS" = "200" ] && echo true || echo false)"

SITE=$(curl -s $API/api/site)
SECTIONS=$(echo "$SITE" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('sections',{})))" 2>/dev/null)
test_it "Site data loads ($SECTIONS sections)" "$([ "$SECTIONS" -gt 0 ] 2>/dev/null && echo true || echo false)"

CATS=$(echo "$SITE" | python -c "import sys,json; print(len(json.load(sys.stdin).get('categories',[])))" 2>/dev/null)
test_it "Categories loaded ($CATS)" "$([ "$CATS" -gt 0 ] 2>/dev/null && echo true || echo false)"

SETTINGS=$(echo "$SITE" | python -c "import sys,json; print(len(json.load(sys.stdin).get('settings',{})))" 2>/dev/null)
test_it "Settings loaded ($SETTINGS keys)" "$([ "$SETTINGS" -gt 0 ] 2>/dev/null && echo true || echo false)"

FOOTER=$(echo "$SITE" | python -c "import sys,json; print(len(json.load(sys.stdin).get('footerLinks',{})))" 2>/dev/null)
test_it "Footer links loaded ($FOOTER cols)" "$([ "$FOOTER" -gt 0 ] 2>/dev/null && echo true || echo false)"

# 2. Auth - Signup
echo ""
echo "--- Auth ---"
SIGNUP=$(curl -s -X POST $API/api/auth/signup -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\",\"password\":\"smoke123\",\"name\":\"Smoke Tester\"}")
SIGNUP_OK=$(echo "$SIGNUP" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('token') else 'false')" 2>/dev/null)
test_it "Signup new user" "$SIGNUP_OK"

# 3. Auth - Duplicate signup
DUP=$(curl -s -X POST $API/api/auth/signup -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\",\"password\":\"smoke123\"}")
DUP_OK=$(echo "$DUP" | python -c "import sys,json; print('true' if 'already exists' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Duplicate signup rejected" "$DUP_OK"

# 4. Auth - Login
LOGIN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\",\"password\":\"smoke123\"}")
TOKEN=$(echo "$LOGIN" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
test_it "Login returns token" "$([ -n "$TOKEN" ] && echo true || echo false)"

# 5. Auth - Bad login
BAD=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\",\"password\":\"wrong\"}")
BAD_OK=$(echo "$BAD" | python -c "import sys,json; print('true' if 'Invalid' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Bad password rejected" "$BAD_OK"

# 6. Auth - Me
ME=$(curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN")
ME_OK=$(echo "$ME" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('email')=='smoke-test@kyroo.de' else 'false')" 2>/dev/null)
test_it "Get current user (/me)" "$ME_OK"

# 7. Auth - Forgot password
FORGOT=$(curl -s -X POST $API/api/auth/forgot-password -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\"}")
FORGOT_OK=$(echo "$FORGOT" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Forgot password request" "$FORGOT_OK"

# 8. Newsletter
echo ""
echo "--- Newsletter ---"
SUB=$(curl -s -X POST $API/api/subscribe -H "Content-Type: application/json" -d "{\"email\":\"smoke-newsletter@kyroo.de\"}")
SUB_OK=$(echo "$SUB" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Subscribe to newsletter" "$SUB_OK"

COUNT=$(curl -s $API/api/subscribers/count)
COUNT_OK=$(echo "$COUNT" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('count',0) > 0 else 'false')" 2>/dev/null)
test_it "Subscriber count > 0" "$COUNT_OK"

# 9. Articles - Public
echo ""
echo "--- Articles (Public) ---"
ARTICLES=$(curl -s $API/api/articles)
ART_COUNT=$(echo "$ARTICLES" | python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
test_it "List articles ($ART_COUNT found)" "$([ "$ART_COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

FILTERED=$(curl -s "$API/api/articles?category=AI")
FILT_OK=$(echo "$FILTERED" | python -c "import sys,json; arts=json.load(sys.stdin); print('true' if len(arts)>0 and all(a['category']=='AI' for a in arts) else 'false')" 2>/dev/null)
test_it "Filter by category (AI)" "$FILT_OK"

FREE_SLUG=$(echo "$ARTICLES" | python -c "import sys,json; arts=json.load(sys.stdin); free=[a for a in arts if not a['is_premium']]; print(free[0]['slug'] if free else '')" 2>/dev/null)
if [ -n "$FREE_SLUG" ]; then
  FREE_ART=$(curl -s "$API/api/articles/$FREE_SLUG")
  FREE_BODY=$(echo "$FREE_ART" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('body') and not d.get('locked') else 'false')" 2>/dev/null)
  test_it "Free article has body (unlocked)" "$FREE_BODY"
fi

PREM_SLUG=$(echo "$ARTICLES" | python -c "import sys,json; arts=json.load(sys.stdin); prem=[a for a in arts if a['is_premium']]; print(prem[0]['slug'] if prem else '')" 2>/dev/null)
if [ -n "$PREM_SLUG" ]; then
  LOCKED_ART=$(curl -s "$API/api/articles/$PREM_SLUG" -H "Authorization: Bearer $TOKEN")
  LOCKED_OK=$(echo "$LOCKED_ART" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('locked') else 'false')" 2>/dev/null)
  test_it "Premium article locked for free user" "$LOCKED_OK"
fi

# 10. Payment Methods & Premium Checkout
echo ""
echo "--- Premium & Payments ---"
PM=$(curl -s -X POST $API/api/payment-methods -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"type\":\"card\",\"card_number\":\"4242424242424242\",\"card_expiry\":\"12/28\",\"card_cvc\":\"123\"}")
PM_ID=$(echo "$PM" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
test_it "Add payment method (card)" "$([ -n "$PM_ID" ] && echo true || echo false)"

PM_LIST=$(curl -s $API/api/payment-methods -H "Authorization: Bearer $TOKEN")
PM_COUNT=$(echo "$PM_LIST" | python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
test_it "List payment methods ($PM_COUNT)" "$([ "$PM_COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

CHECKOUT=$(curl -s -X POST $API/api/premium/checkout -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"payment_method_id\":$PM_ID,\"plan\":\"yearly\"}")
CHECKOUT_OK=$(echo "$CHECKOUT" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('user',{}).get('is_premium') else 'false')" 2>/dev/null)
NEW_TOKEN=$(echo "$CHECKOUT" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
test_it "Checkout yearly plan" "$CHECKOUT_OK"

if [ -n "$PREM_SLUG" ] && [ -n "$NEW_TOKEN" ]; then
  UNLOCKED=$(curl -s "$API/api/articles/$PREM_SLUG" -H "Authorization: Bearer $NEW_TOKEN")
  UNLOCKED_OK=$(echo "$UNLOCKED" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if not d.get('locked') and d.get('body') else 'false')" 2>/dev/null)
  test_it "Premium article unlocked after checkout" "$UNLOCKED_OK"
fi

PAYMENTS=$(curl -s $API/api/payments -H "Authorization: Bearer $NEW_TOKEN")
PAY_OK=$(echo "$PAYMENTS" | python -c "import sys,json; print('true' if len(json.load(sys.stdin)) > 0 else 'false')" 2>/dev/null)
test_it "Payment history has records" "$PAY_OK"

CANCEL=$(curl -s -X POST $API/api/premium/cancel -H "Authorization: Bearer $NEW_TOKEN")
CANCEL_OK=$(echo "$CANCEL" | python -c "import sys,json; print('true' if not json.load(sys.stdin).get('user',{}).get('is_premium') else 'false')" 2>/dev/null)
test_it "Cancel premium" "$CANCEL_OK"

# 11. Admin
echo ""
echo "--- Admin ---"
ADMIN_LOGIN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"okamara@gmail.com\",\"password\":\"Apache2008//!!\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
test_it "Admin login" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

STATS=$(curl -s $API/api/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN")
STATS_OK=$(echo "$STATS" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if 'total_users' in d else 'false')" 2>/dev/null)
test_it "Admin stats" "$STATS_OK"

CREATE=$(curl -s -X POST $API/api/admin/articles -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"Smoke Test Article\",\"slug\":\"smoke-test-article\",\"category\":\"Trends\",\"excerpt\":\"Testing creation\",\"body\":\"Full body content.\",\"is_premium\":false}")
NEW_ID=$(echo "$CREATE" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
test_it "Create article" "$([ -n "$NEW_ID" ] && echo true || echo false)"

UPDATE=$(curl -s -X PUT "$API/api/admin/articles/$NEW_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"Smoke Test (Updated)\"}")
UPDATE_OK=$(echo "$UPDATE" | python -c "import sys,json; print('true' if 'Updated' in json.load(sys.stdin).get('title','') else 'false')" 2>/dev/null)
test_it "Update article" "$UPDATE_OK"

DEL=$(curl -s -X DELETE "$API/api/admin/articles/$NEW_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
DEL_OK=$(echo "$DEL" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Delete article" "$DEL_OK"

NONADMIN=$(curl -s $API/api/admin/stats -H "Authorization: Bearer $TOKEN")
NONADMIN_OK=$(echo "$NONADMIN" | python -c "import sys,json; e=json.load(sys.stdin).get('error',''); print('true' if 'Admin' in e or 'required' in e or 'Invalid' in e else 'false')" 2>/dev/null)
test_it "Non-admin blocked from admin" "$NONADMIN_OK"

# Admin sees premium articles unlocked
if [ -n "$PREM_SLUG" ]; then
  ADMIN_ART=$(curl -s "$API/api/articles/$PREM_SLUG" -H "Authorization: Bearer $ADMIN_TOKEN")
  ADMIN_ART_OK=$(echo "$ADMIN_ART" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if not d.get('locked') and d.get('body') else 'false')" 2>/dev/null)
  test_it "Admin sees premium content (no paywall)" "$ADMIN_ART_OK"
fi

# 12. GDPR
echo ""
echo "--- GDPR ---"
RELOGIN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\",\"password\":\"smoke123\"}")
SMOKE_TOKEN=$(echo "$RELOGIN" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

EXPORT=$(curl -s $API/api/account/data-export -H "Authorization: Bearer $SMOKE_TOKEN")
EXPORT_OK=$(echo "$EXPORT" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('data_controller') and d.get('user_data') else 'false')" 2>/dev/null)
test_it "Data export (Art. 15 & 20)" "$EXPORT_OK"

DELETE_ACC=$(curl -s -X DELETE $API/api/account -H "Authorization: Bearer $SMOKE_TOKEN")
DELETE_OK=$(echo "$DELETE_ACC" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Delete account (Art. 17)" "$DELETE_OK"

DEAD=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"smoke-test@kyroo.de\",\"password\":\"smoke123\"}")
DEAD_OK=$(echo "$DEAD" | python -c "import sys,json; print('true' if 'Invalid' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Deleted user cannot login" "$DEAD_OK"

# 13. WebSocket
echo ""
echo "--- WebSocket ---"
WS_OK=$(timeout 5 node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');
ws.on('open', () => { console.log('true'); ws.close(); process.exit(0); });
ws.on('error', () => { console.log('false'); process.exit(1); });
setTimeout(() => { console.log('false'); process.exit(1); }, 4000);
" 2>/dev/null)
test_it "WebSocket connects" "$WS_OK"

# 14. Swagger & Static Pages
echo ""
echo "--- Pages & Docs ---"
SWAGGER=$(curl -s -o /dev/null -w "%{http_code}" $API/api-docs/)
test_it "Swagger UI (api-docs)" "$([ "$SWAGGER" = "200" ] && echo true || echo false)"

ADMIN_PAGE=$(curl -s -o /dev/null -w "%{http_code}" $API/admin.html)
test_it "Admin page" "$([ "$ADMIN_PAGE" = "200" ] && echo true || echo false)"

RESET_PAGE=$(curl -s -o /dev/null -w "%{http_code}" $API/reset-password.html)
test_it "Reset password page" "$([ "$RESET_PAGE" = "200" ] && echo true || echo false)"

FAVICON=$(curl -s -o /dev/null -w "%{http_code}" $API/favicon.svg)
test_it "Favicon" "$([ "$FAVICON" = "200" ] && echo true || echo false)"

CSS=$(curl -s -o /dev/null -w "%{http_code}" $API/styles.css)
test_it "CSS stylesheet" "$([ "$CSS" = "200" ] && echo true || echo false)"

JS=$(curl -s -o /dev/null -w "%{http_code}" $API/script.js)
test_it "Frontend JS" "$([ "$JS" = "200" ] && echo true || echo false)"

# Cleanup
docker exec kyroo-db sh -c "psql -U kyroo -d kyroo -c \"DELETE FROM subscribers WHERE email = 'smoke-newsletter@kyroo.de'\"" >/dev/null 2>&1

# Results
echo ""
echo "======================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL $TOTAL TESTS PASSED"
else
  echo "  $PASS passed / $FAIL failed / $TOTAL total"
fi
echo "======================================"
echo ""
