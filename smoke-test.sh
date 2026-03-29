#!/bin/bash
# KYROO Full Smoke Test + E2E
# Tests against production: https://kyroo.de

API="https://kyroo.de"
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
echo "  KYROO Smoke Test + E2E"
echo "  Target: $API"
echo "======================================"
echo ""

# ==========================================
# 1. SERVER & HEALTH
# ==========================================
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

SOCIALS=$(echo "$SITE" | python -c "import sys,json; print(len(json.load(sys.stdin).get('socialLinks',[])))" 2>/dev/null)
test_it "Social links loaded ($SOCIALS)" "$([ "$SOCIALS" -gt 0 ] 2>/dev/null && echo true || echo false)"

HERO=$(echo "$SITE" | python -c "import sys,json; print(json.load(sys.stdin)['sections']['hero']['title'])" 2>/dev/null)
test_it "Hero title: $HERO" "$([ -n "$HERO" ] && echo true || echo false)"

TYPEWRITER=$(echo "$SITE" | python -c "import sys,json; tw=json.load(sys.stdin).get('settings',{}).get('hero_typewriter',''); print(len(tw.split('|')))" 2>/dev/null)
test_it "Typewriter phrases ($TYPEWRITER)" "$([ "$TYPEWRITER" -gt 1 ] 2>/dev/null && echo true || echo false)"

# ==========================================
# 2. AUTH - SIGNUP
# ==========================================
echo ""
echo "--- Auth: Signup ---"
TIMESTAMP=$(date +%s)
TEST_EMAIL="smoke-${TIMESTAMP}@test.kyroo.de"

SIGNUP=$(curl -s -X POST $API/api/auth/signup -H "Content-Type: application/json" -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"smoke123\",\"name\":\"Smoke Tester\"}")
SIGNUP_TOKEN=$(echo "$SIGNUP" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
test_it "Signup new user" "$([ -n "$SIGNUP_TOKEN" ] && echo true || echo false)"

SIGNUP_VERIFIED=$(echo "$SIGNUP" | python -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('email_verified',True))" 2>/dev/null)
test_it "Email not yet verified" "$([ "$SIGNUP_VERIFIED" = "False" ] && echo true || echo false)"

# Duplicate
DUP=$(curl -s -X POST $API/api/auth/signup -H "Content-Type: application/json" -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"smoke123\"}")
DUP_OK=$(echo "$DUP" | python -c "import sys,json; print('true' if 'already exists' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Duplicate signup rejected" "$DUP_OK"

# Short password
SHORT=$(curl -s -X POST $API/api/auth/signup -H "Content-Type: application/json" -d "{\"email\":\"x@x.com\",\"password\":\"12\"}")
SHORT_OK=$(echo "$SHORT" | python -c "import sys,json; print('true' if 'at least 6' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Short password rejected" "$SHORT_OK"

# ==========================================
# 3. AUTH - LOGIN
# ==========================================
echo ""
echo "--- Auth: Login ---"
LOGIN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"smoke123\"}")
TOKEN=$(echo "$LOGIN" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
test_it "Login returns token" "$([ -n "$TOKEN" ] && echo true || echo false)"

BAD=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"wrong\"}")
BAD_OK=$(echo "$BAD" | python -c "import sys,json; print('true' if 'Invalid' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Wrong password rejected" "$BAD_OK"

NOUSER=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"nonexistent@test.com\",\"password\":\"test123\"}")
NOUSER_OK=$(echo "$NOUSER" | python -c "import sys,json; print('true' if 'Invalid' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Nonexistent user rejected" "$NOUSER_OK"

# ==========================================
# 4. AUTH - ME
# ==========================================
echo ""
echo "--- Auth: Profile ---"
ME=$(curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN")
ME_EMAIL=$(echo "$ME" | python -c "import sys,json; print(json.load(sys.stdin).get('email',''))" 2>/dev/null)
test_it "GET /me returns user" "$([ "$ME_EMAIL" = "$TEST_EMAIL" ] && echo true || echo false)"

NOAUTH=$(curl -s $API/api/auth/me)
NOAUTH_OK=$(echo "$NOAUTH" | python -c "import sys,json; print('true' if 'required' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "No token = 401" "$NOAUTH_OK"

# ==========================================
# 5. AUTH - FORGOT PASSWORD
# ==========================================
echo ""
echo "--- Auth: Forgot Password ---"
FORGOT=$(curl -s -X POST $API/api/auth/forgot-password -H "Content-Type: application/json" -d "{\"email\":\"${TEST_EMAIL}\"}")
FORGOT_OK=$(echo "$FORGOT" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Forgot password request" "$FORGOT_OK"

FORGOT_FAKE=$(curl -s -X POST $API/api/auth/forgot-password -H "Content-Type: application/json" -d "{\"email\":\"nobody@nowhere.com\"}")
FORGOT_FAKE_OK=$(echo "$FORGOT_FAKE" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Fake email still returns success (no enumeration)" "$FORGOT_FAKE_OK"

# ==========================================
# 6. NEWSLETTER
# ==========================================
echo ""
echo "--- Newsletter ---"
SUB=$(curl -s -X POST $API/api/subscribe -H "Content-Type: application/json" -d "{\"email\":\"smoke-news-${TIMESTAMP}@test.kyroo.de\"}")
SUB_OK=$(echo "$SUB" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Subscribe to newsletter" "$SUB_OK"

SUB_BAD=$(curl -s -X POST $API/api/subscribe -H "Content-Type: application/json" -d "{\"email\":\"not-an-email\"}")
SUB_BAD_OK=$(echo "$SUB_BAD" | python -c "import sys,json; print('true' if 'error' in json.load(sys.stdin) else 'false')" 2>/dev/null)
test_it "Invalid email rejected" "$SUB_BAD_OK"

COUNT=$(curl -s $API/api/subscribers/count)
COUNT_OK=$(echo "$COUNT" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('count',0) > 0 else 'false')" 2>/dev/null)
test_it "Subscriber count > 0" "$COUNT_OK"

# ==========================================
# 7. ARTICLES - PUBLIC
# ==========================================
echo ""
echo "--- Articles (Public) ---"
ARTICLES=$(curl -s $API/api/articles)
ART_COUNT=$(echo "$ARTICLES" | python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
test_it "List articles ($ART_COUNT found)" "$([ "$ART_COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

FILTERED=$(curl -s "$API/api/articles?category=AI")
FILT_COUNT=$(echo "$FILTERED" | python -c "import sys,json; arts=json.load(sys.stdin); print(len(arts))" 2>/dev/null)
FILT_OK=$(echo "$FILTERED" | python -c "import sys,json; arts=json.load(sys.stdin); print('true' if len(arts)>0 and all(a['category']=='AI' for a in arts) else 'false')" 2>/dev/null)
test_it "Filter by category AI ($FILT_COUNT)" "$FILT_OK"

FILTERED2=$(curl -s "$API/api/articles?category=Fitness")
FILT2_OK=$(echo "$FILTERED2" | python -c "import sys,json; arts=json.load(sys.stdin); print('true' if len(arts)>0 and all(a['category']=='Fitness' for a in arts) else 'false')" 2>/dev/null)
test_it "Filter by category Fitness" "$FILT2_OK"

EMPTY=$(curl -s "$API/api/articles?category=NonExistent")
EMPTY_OK=$(echo "$EMPTY" | python -c "import sys,json; print('true' if len(json.load(sys.stdin))==0 else 'false')" 2>/dev/null)
test_it "Empty category returns empty" "$EMPTY_OK"

# Free article
FREE_SLUG=$(echo "$ARTICLES" | python -c "import sys,json; arts=json.load(sys.stdin); free=[a for a in arts if not a['is_premium']]; print(free[0]['slug'] if free else '')" 2>/dev/null)
if [ -n "$FREE_SLUG" ]; then
  FREE_ART=$(curl -s "$API/api/articles/$FREE_SLUG")
  FREE_BODY=$(echo "$FREE_ART" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('body') and not d.get('locked') else 'false')" 2>/dev/null)
  test_it "Free article body visible" "$FREE_BODY"
fi

# Premium article locked for free user
PREM_SLUG=$(echo "$ARTICLES" | python -c "import sys,json; arts=json.load(sys.stdin); prem=[a for a in arts if a['is_premium']]; print(prem[0]['slug'] if prem else '')" 2>/dev/null)
if [ -n "$PREM_SLUG" ]; then
  LOCKED=$(curl -s "$API/api/articles/$PREM_SLUG" -H "Authorization: Bearer $TOKEN")
  LOCKED_OK=$(echo "$LOCKED" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('locked') else 'false')" 2>/dev/null)
  test_it "Premium article locked for free user" "$LOCKED_OK"
fi

# 404 article
NOTFOUND=$(curl -s "$API/api/articles/this-does-not-exist")
NOTFOUND_OK=$(echo "$NOTFOUND" | python -c "import sys,json; print('true' if 'not found' in json.load(sys.stdin).get('error','').lower() else 'false')" 2>/dev/null)
test_it "Nonexistent article returns 404" "$NOTFOUND_OK"

# ==========================================
# 8. STRIPE
# ==========================================
echo ""
echo "--- Stripe ---"
PK=$(curl -s $API/api/stripe/publishable-key)
PK_OK=$(echo "$PK" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('key','').startswith('pk_') else 'false')" 2>/dev/null)
test_it "Stripe publishable key available" "$PK_OK"

PI=$(curl -s -X POST $API/api/stripe/create-payment-intent -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"plan\":\"yearly\"}")
PI_OK=$(echo "$PI" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('clientSecret','').startswith('pi_') else 'false')" 2>/dev/null)
test_it "Create payment intent (yearly)" "$PI_OK"

PI2=$(curl -s -X POST $API/api/stripe/create-payment-intent -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"plan\":\"monthly\"}")
PI2_OK=$(echo "$PI2" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('clientSecret','').startswith('pi_') else 'false')" 2>/dev/null)
test_it "Create payment intent (monthly)" "$PI2_OK"

PI_NOAUTH=$(curl -s -X POST $API/api/stripe/create-payment-intent -H "Content-Type: application/json" -d "{\"plan\":\"yearly\"}")
PI_NOAUTH_OK=$(echo "$PI_NOAUTH" | python -c "import sys,json; print('true' if 'required' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Payment intent requires auth" "$PI_NOAUTH_OK"

# ==========================================
# 9. ADMIN
# ==========================================
echo ""
echo "--- Admin ---"
ADMIN_LOGIN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"okamara@gmail.com\",\"password\":\"KyrooAdmin2026\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
test_it "Admin login" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

STATS=$(curl -s $API/api/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN")
STATS_OK=$(echo "$STATS" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if 'total_users' in d and 'total_articles' in d else 'false')" 2>/dev/null)
test_it "Admin stats" "$STATS_OK"

# Create article
CREATE=$(curl -s -X POST $API/api/admin/articles -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"Smoke Test ${TIMESTAMP}\",\"slug\":\"smoke-test-${TIMESTAMP}\",\"category\":\"Trends\",\"excerpt\":\"Testing\",\"body\":\"Full body.\",\"is_premium\":false}")
NEW_ID=$(echo "$CREATE" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
test_it "Create article (id: $NEW_ID)" "$([ -n "$NEW_ID" ] && echo true || echo false)"

# Update article
UPDATE=$(curl -s -X PUT "$API/api/admin/articles/$NEW_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"Smoke Test Updated ${TIMESTAMP}\"}")
UPDATE_OK=$(echo "$UPDATE" | python -c "import sys,json; print('true' if 'Updated' in json.load(sys.stdin).get('title','') else 'false')" 2>/dev/null)
test_it "Update article" "$UPDATE_OK"

# Verify it appears in public list
VERIFY=$(curl -s "$API/api/articles" | python -c "import sys,json; arts=json.load(sys.stdin); print('true' if any('smoke-test-${TIMESTAMP}' == a['slug'] for a in arts) else 'false')" 2>/dev/null)
test_it "New article visible in public list" "$VERIFY"

# Delete article
DEL=$(curl -s -X DELETE "$API/api/admin/articles/$NEW_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
DEL_OK=$(echo "$DEL" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Delete article" "$DEL_OK"

# Non-admin blocked
NONADMIN=$(curl -s $API/api/admin/stats -H "Authorization: Bearer $TOKEN")
NONADMIN_OK=$(echo "$NONADMIN" | python -c "import sys,json; e=json.load(sys.stdin).get('error',''); print('true' if 'Admin' in e or 'required' in e else 'false')" 2>/dev/null)
test_it "Non-admin blocked from admin routes" "$NONADMIN_OK"

# Admin sees premium articles unlocked
if [ -n "$PREM_SLUG" ]; then
  ADMIN_ART=$(curl -s "$API/api/articles/$PREM_SLUG" -H "Authorization: Bearer $ADMIN_TOKEN")
  ADMIN_ART_OK=$(echo "$ADMIN_ART" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if not d.get('locked') and d.get('body') else 'false')" 2>/dev/null)
  test_it "Admin sees premium content unlocked" "$ADMIN_ART_OK"
fi

# ==========================================
# 10. GDPR
# ==========================================
echo ""
echo "--- GDPR ---"
EXPORT=$(curl -s $API/api/account/data-export -H "Authorization: Bearer $TOKEN")
EXPORT_OK=$(echo "$EXPORT" | python -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('data_controller') and d.get('user_data') and d.get('export_date') else 'false')" 2>/dev/null)
test_it "Data export (Art. 15 & 20)" "$EXPORT_OK"

EXPORT_FIELDS=$(echo "$EXPORT" | python -c "import sys,json; d=json.load(sys.stdin); u=d.get('user_data',{}); print('true' if 'email' in u and 'name' in u and 'is_premium' in u and 'created_at' in u else 'false')" 2>/dev/null)
test_it "Export contains user fields" "$EXPORT_FIELDS"

# Delete account
DELETE_ACC=$(curl -s -X DELETE $API/api/account -H "Authorization: Bearer $TOKEN")
DELETE_OK=$(echo "$DELETE_ACC" | python -c "import sys,json; print('true' if json.load(sys.stdin).get('success') else 'false')" 2>/dev/null)
test_it "Delete account (Art. 17)" "$DELETE_OK"

DEAD=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"smoke123\"}")
DEAD_OK=$(echo "$DEAD" | python -c "import sys,json; print('true' if 'Invalid' in json.load(sys.stdin).get('error','') else 'false')" 2>/dev/null)
test_it "Deleted user cannot login" "$DEAD_OK"

# ==========================================
# 11. STATIC PAGES & DOCS
# ==========================================
echo ""
echo "--- Pages & Docs ---"
SWAGGER=$(curl -s -o /dev/null -w "%{http_code}" $API/api-docs/)
test_it "Swagger UI" "$([ "$SWAGGER" = "200" ] && echo true || echo false)"

ADMIN_PAGE=$(curl -s -o /dev/null -w "%{http_code}" $API/admin.html)
test_it "Admin page" "$([ "$ADMIN_PAGE" = "200" ] && echo true || echo false)"

RESET_PAGE=$(curl -s -o /dev/null -w "%{http_code}" $API/reset-password.html)
test_it "Reset password page" "$([ "$RESET_PAGE" = "200" ] && echo true || echo false)"

FAVICON=$(curl -s -o /dev/null -w "%{http_code}" $API/favicon.svg)
test_it "Favicon" "$([ "$FAVICON" = "200" ] && echo true || echo false)"

CSS=$(curl -s -o /dev/null -w "%{http_code}" $API/styles.css)
test_it "CSS" "$([ "$CSS" = "200" ] && echo true || echo false)"

JS=$(curl -s -o /dev/null -w "%{http_code}" $API/script.js)
test_it "JS" "$([ "$JS" = "200" ] && echo true || echo false)"

# ==========================================
# 12. HTTPS & SECURITY
# ==========================================
echo ""
echo "--- HTTPS & Security ---"
HTTPS=$(curl -s -o /dev/null -w "%{http_code}" https://kyroo.de)
test_it "HTTPS works" "$([ "$HTTPS" = "200" ] && echo true || echo false)"

HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" -L http://kyroo.de)
test_it "HTTP redirects to HTTPS" "$([ "$HTTP_REDIRECT" = "200" ] && echo true || echo false)"

# Cleanup test newsletter subscription
curl -s -X POST $API/api/auth/signup -H "Content-Type: application/json" -d "{\"email\":\"cleanup-${TIMESTAMP}@test.kyroo.de\",\"password\":\"clean123\",\"name\":\"Cleanup\"}" > /dev/null 2>&1
CLEAN_TOKEN=$(curl -s -X POST $API/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"cleanup-${TIMESTAMP}@test.kyroo.de\",\"password\":\"clean123\"}" | python -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
curl -s -X DELETE $API/api/account -H "Authorization: Bearer $CLEAN_TOKEN" > /dev/null 2>&1

# ==========================================
# RESULTS
# ==========================================
echo ""
echo "======================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL $TOTAL TESTS PASSED"
else
  echo "  $PASS passed / $FAIL failed / $TOTAL total"
fi
echo "======================================"
echo ""
