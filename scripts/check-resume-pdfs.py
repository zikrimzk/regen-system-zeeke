"""Inspect real exported PDFs, then render every page for visual review.
Usage: python scripts/check-resume-pdfs.py [--render]
Uses the bundled Poppler executable or pdftoppm on PATH.
"""
from pathlib import Path
import json, re, sys, unicodedata, subprocess, shutil, os
import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
folder = root / 'tmp/pdfs/current'
records = json.loads((folder/'manifest.json').read_text(encoding='utf8'))
failures, results = [], []
assertions = 0
def check(value, message):
    global assertions
    assertions += 1
    if not value: failures.append(message)
def norm(value):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC',str(value))).casefold()
def expected(data):
    values=[]
    for field in ['fullName','jobTitle','email','phone','address','linkedin']:
        if data['personal'].get(field):
            value=data['personal'][field]
            if field=='linkedin': value=re.sub(r'^https?://(?:www\.)?', '', value.rstrip('/'), flags=re.I)
            values.append(value)
    if data.get('summary'): values.append(data['summary'])
    for section,fields in {'education':['degree','institution','location','cgpa'],'experience':['jobTitle','company','employmentType','location'],'projects':['title','type','description'],'extracurricular':['organization','role'],'references':['name','position','email','phone']}.items():
        for entry in data.get(section,[]):
            values.extend(entry[f] for f in fields if entry.get(f))
            values.extend(entry.get('bullets',[]))
    for field,value in data.get('skills',{}).items():
        if isinstance(value,str) and value: values.append(value)
        elif field=='custom':
            for item in value: values.extend(v for v in item.values() if isinstance(v,str) and v)
    values.extend(data.get('achievements',[])); values.extend(data.get('certifications',[]))
    return values
heading_labels={'summary':'Summary','experience':'Work Experience','education':'Education','projects':'Projects','extracurricular':'Activities','skills':'Skills','achievements':'Achievements','certifications':'Certifications','references':'References'}

for item in records:
    path=folder/(item['name']+'.pdf'); reader=PdfReader(path)
    raw='\n'.join(p.extract_text() or '' for p in reader.pages)
    text=norm(raw)
    name_position=text.find(norm(item['data']['personal']['fullName']))
    first_heading=min((text.find(norm(v)) for v in heading_labels.values() if text.find(norm(v))>=0),default=len(text))
    check(0<=name_position<first_heading,item['name']+': identity is not first in extracted PDF reading order')
    check('\u200b' not in raw and '\ufffd' not in raw, item['name']+': invisible breaks or replacement characters in PDF text')
    for value in expected(item['data']):
        check(norm(value) in text,item['name']+': lost or scrambled text: '+str(value)[:90])
    pages=[]
    with pdfplumber.open(path) as document:
        for number,page in enumerate(document.pages,1):
            words=page.extract_words(x_tolerance=1,y_tolerance=3)
            check(bool(words),item['name']+f': blank page {number}')
            check(abs(page.width-595.28)<1 and abs(page.height-841.89)<1,item['name']+': paper is not A4')
            for w in words:
                check(w['x0']>=42 and w['x1']<=page.width-42 and w['top']>=40 and w['bottom']<=page.height-40,item['name']+f': text outside margins, page {number}: '+w['text'][:30])
            last=max((w['bottom'] for w in words),default=0)
            if number<len(document.pages):check(last>=page.height-110,item['name']+f': excessive unused space before page {number+1} ({page.height-last:.1f} pt)')
            lines=page.extract_text_lines(x_tolerance=1,y_tolerance=3)
            if lines:
                check(norm(lines[-1]['text']) not in {norm(v) for v in heading_labels.values()},item['name']+f': orphan section heading on page {number}')
            pages.append({'page':number,'words':len(words),'last_text_pt':round(last,2)})
    maximum=8 if item['profile']=='stress' else 2 if item['profile']=='senior' else 1
    check(len(reader.pages)<=maximum,item['name']+f': unexpectedly long ({len(reader.pages)} pages)')
    positions=[]; cursor=0
    for section in item['data']['sectionOrder']:
        if not item['data'].get(section):continue
        label=norm(heading_labels[section]); pos=text.find(label,cursor)
        check(pos>=cursor,item['name']+': section reading order incorrect: '+section)
        if pos>=0:cursor=pos+len(label);positions.append(pos)
    check(path.stat().st_size<1_000_000,item['name']+': unexpectedly large PDF')
    results.append({'template':item['id'],'profile':item['profile'],'pages':len(reader.pages),'bytes':path.stat().st_size,'page_details':pages})

for path in folder.glob('*-letter.pdf'):
    reader=PdfReader(path)
    check(len(reader.pages)==1,path.name+': standard matching letter should fit one page')
    text=norm(''.join(p.extract_text() or '' for p in reader.pages))
    check(any(closing in text for closing in ('yourssincerely','yoursfaithfully')),path.name+': closing text missing')

if '--render' in sys.argv:
    poppler=shutil.which('pdftoppm')
    if not poppler: raise RuntimeError('pdftoppm is required for visual review')
    visuals=folder/'visuals'; visuals.mkdir(exist_ok=True)
    # Remove only this run's temporary renders so a shortened PDF cannot leave a stale second page.
    for stale in [*visuals.glob('*.png'),*visuals.glob('*-board-*.jpg')]: stale.unlink()
    for path in sorted(folder.glob('*.pdf')):
        subprocess.run([poppler,'-r','96','-png',str(path),str(visuals/path.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    for profile in ['professional','graduate','senior','stress','sparse','letter']:
        images=sorted(visuals.glob('*-'+profile+'-*.png'))
        boards=[]
        for start in range(0,len(images),16):
            subset=images[start:start+16]; board=Image.new('RGB',(1280,458*((len(subset)+3)//4)),'#e5e7eb')
            for index,p in enumerate(subset):
                image=Image.open(p).convert('RGB');image.thumbnail((298,422));tile=Image.new('RGB',(320,458),'#e5e7eb');tile.paste(image,((320-image.width)//2,28));ImageDraw.Draw(tile).text((10,7),p.stem,fill='black');board.paste(tile,((index%4)*320,(index//4)*458))
            board.save(visuals/(profile+'-board-'+str(start//16+1)+'.jpg'),quality=92)

report={'assertions':assertions,'failures':failures,'documents':results}
(folder/'quality-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'assertions':assertions,'failures':failures,'resume_count':len(results),'page_counts':{profile:sorted({r['pages'] for r in results if r['profile']==profile}) for profile in ['professional','graduate','senior','stress','sparse']}},indent=2))
sys.exit(1 if failures else 0)
