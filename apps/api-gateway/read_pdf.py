import PyPDF2
import re

reader = PyPDF2.PdfReader(r'c:\Users\raoui\OneDrive\Bureau\TechKids\techkids-hub\pfe (5).pdf')
text = '\n'.join([page.extract_text() for page in reader.pages if page.extract_text()])
lines = text.split('\n')
for i, line in enumerate(lines):
    if re.search(r'temps r.el|polling|websocket|socket\.io|sse\b|server.?sent|pusher', line, re.IGNORECASE):
        start = max(0, i-2)
        end = min(len(lines), i+3)
        print("MATCH FOUND:")
        print("... " + " ".join([l.strip() for l in lines[start:end]]) + " ...")
