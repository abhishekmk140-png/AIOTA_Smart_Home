@echo off
title AIOTA Public Cloudflare Tunnel
echo Starting public tunnel for http://localhost:5173 ...
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173
pause
