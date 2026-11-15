"""Validate the actual letter exports, including typography, content and page geometry."""
from pathlib import Path
import json,re,subprocess,shutil
import pdfplumber
from pypdf import PdfReader

folder=Path(__file__).resolve().parents[1]/'tmp/strict-package-review/letters'
manifest=json.loads((folder/'manifest.json').read_text());assertions=0
def check(ok,message):
    global assertions
    assertions+=1
    if not ok:raise AssertionError(message)
def norm(text):return re.sub(r'\s+','',text)
for item in manifest:
    path=folder/(item['name']+'.pdf');reader=PdfReader(path)
    text='\n'.join(page.extract_text() or '' for page in reader.pages)
    check(norm(item['body']) in norm(text),item['name']+' lost or reordered body content')
    check(text.strip().endswith(item['nameText']),item['name']+' lost signature')
    check(norm(item['body'].strip().split('\n\n')[-1]) in norm(reader.pages[-1].extract_text() or ''),item['name']+' closing stranded without its final paragraph')
    check(('8 November 2026' in text),item['name']+' changed selected date')
    check(len(reader.pages)==1 if item['kind']=='standard' else len(reader.pages)>1,item['name']+' unexpected page count')
    with pdfplumber.open(path) as document:
        chars=[char for page in document.pages for char in page.chars if char['text'].strip()]
        check(min(c['size'] for c in chars)>=10,item['name']+' text too small')
        check(sum(abs(c['size']-float(item['size']))<.1 for c in chars)>100,item['name']+' ignored selected body size')
        margin=item.get('marginPoints',23*72/25.4)
        if 'nameSize' in item:
            check(abs(chars[0]['size']-item['nameSize'])<.1,item['name']+' ignored selected name size')
            check(abs(chars[0]['x0']-margin)<1,item['name']+' ignored selected horizontal margin')
        for page in document.pages:
            words=page.extract_words();check(bool(words),item['name']+' blank page')
            check(all(w['x0']>=margin-1 and w['x1']<=page.width-margin+1 and w['top']>=margin-7 and w['bottom']<=page.height-margin+7 for w in words),item['name']+' text outside letter margins')
    check('Yours sincerely,' in text or 'Yours faithfully,' in text,item['name']+' missing formal closing')
poppler=shutil.which('pdftoppm');check(bool(poppler),'Poppler is required for visual review')
for name in ['modern','classic','modern-12pt','long-letter']:
    subprocess.run([poppler,'-scale-to','1400','-png',str(folder/(name+'.pdf')),str(folder/name)],check=True,capture_output=True)
(folder/'quality-report.json').write_text(json.dumps({'exports':len(manifest),'assertions':assertions,'failures':[]},indent=2))
print(f'Cover-letter layout passed: {len(manifest)} exports, {assertions} assertions; PNGs rendered for visual inspection.')
