#!/bin/zsh
# پروب Mode C — سرور + کروم + پروب باید در **یک فراخوانی پیش‌زمینه** باشند.
# چرا: سروری که در فراخوانی قبلی بالا آمده باشد، زنده نمی‌ماند؛ و پوستهٔ پس‌زمینه
# به localhost همان ۵۰۲ را می‌دهد که «سرور مرده» به نظر می‌رسد.
set -u
cd /Users/heidarian2/Documents/D-DayProject

LOG=/tmp/probe-group.log
: > "$LOG"

npm run dev -- --port 5199 --strictPort > /tmp/vite5199.log 2>&1 &
VITE_PID=$!

CODE=000
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5199/ 2>/dev/null || true)
  [[ "$CODE" == "200" ]] && break
  sleep 1
done
echo "vite-ready=$CODE after ${i}s" >> "$LOG"

rm -rf /tmp/probe-chrome
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=9333 --user-data-dir=/tmp/probe-chrome \
  about:blank > /tmp/chrome.log 2>&1 &
CHROME_PID=$!
sleep 3

node "${1:-.probe-group.mjs}" >> "$LOG" 2>&1
echo "probe-exit=$?" >> "$LOG"

kill $CHROME_PID 2>/dev/null
kill $VITE_PID 2>/dev/null
sleep 1
rm -rf /tmp/probe-chrome
echo "ALL-DONE" >> "$LOG"
