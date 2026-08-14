const TOKEN = process.env.META_TOKEN
const ACCOUNT_ID = '908256752348097'
const BASE = 'https://graph.facebook.com/v19.0'

async function makeCall(url) {
  try {
    const res = await fetch(`${url}&access_token=${TOKEN}`)
    const data = await res.json()
    if (data.error) {
      console.log('ERROR:', data.error.message)
      return false
    }
    return true
  } catch(e) {
    console.log('FAILED:', e.message)
    return false
  }
}

async function run() {
  let success = 0
  let errors = 0
  const calls = [
    `${BASE}/me/adaccounts?fields=id,name`,
    `${BASE}/act_${ACCOUNT_ID}/campaigns?fields=id,name,status,objective&limit=10`,
    `${BASE}/act_${ACCOUNT_ID}/insights?fields=spend,reach,impressions,clicks,ctr&date_preset=last_30_days&level=campaign`,
    `${BASE}/act_${ACCOUNT_ID}/adsets?fields=id,name,status&limit=10`,
  ]

  console.log('Starting 500 API calls...')

  for (let i = 0; i < 500; i++) {
    const url = calls[i % calls.length]
    const ok = await makeCall(url)
    if (ok) success++
    else errors++

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/500 — Success: ${success}, Errors: ${errors}`)
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone! Total: 500, Success: ${success}, Errors: ${errors}`)
  console.log(`Success rate: ${((success/500)*100).toFixed(1)}%`)
}

run()
