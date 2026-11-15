"""Check the real objective/CV/letter exports, then render all pages for visual review."""
from pathlib import Path
import json,re,unicodedata,shutil,subprocess
import pdfplumber
from pypdf import PdfReader
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];folder=root/'tmp/pdfs/writing'
records=json.loads((folder/'manifest.json').read_text());count=0
def check(ok,message):
    global count
    count+=1
    if not ok:raise AssertionError(message)
def norm(v):return re.sub(r'\s+','',unicodedata.normalize('NFKC',v)).casefold()
poppler=shutil.which('pdftoppm');assert poppler,'pdftoppm is required'
visual=folder/'visuals';visual.mkdir(exist_ok=True)
for old in list(visual.glob('*.png'))+list(visual.glob('writing-board-*.jpg')):old.unlink()
pages=[];results=[]
for item in records:
    path=folder/(item['name']+'.pdf');reader=PdfReader(path)
    text='\n'.join(p.extract_text() or '' for p in reader.pages)
    check(norm(text).startswith(norm(item['profile'])),item['name']+' identity reading order')
    for value in item['expected']:check(norm(value) in norm(text),item['name']+' missing '+value)
    check('PRIVATE TARGET NOTES' not in text,item['name']+' exposed job notes')
    if item['type'] in ['objective','letter']:check(len(reader.pages)==1,item['name']+' standard document exceeds one page')
    if item['type']=='sized-resume':check(len(reader.pages)<=2,item['name']+' normal job resume exceeds two pages')
    if item['type']=='long-cv':check(len(reader.pages)>2,'Academic CV must retain content beyond two pages')
    with pdfplumber.open(path) as doc:
        chars=[char for page in doc.pages for char in page.chars if char['text'].strip()]
        check(sum(abs(char['size']-item['body_size'])<.1 for char in chars)>50,item['name']+' selected body size not present in real PDF')
        check(min(char['size'] for char in chars)>=9.9,item['name']+' text smaller than 10 pt')
        check(all('Inter' in char['fontname'] or 'DejaVuSerif' in char['fontname'] for char in chars),item['name']+' unexpected fallback font')
        for page in doc.pages:
            words=page.extract_words();check(bool(words),item['name']+' blank page')
            for word in words:check(word['x0']>=42 and word['x1']<=page.width-42 and word['top']>=40 and word['bottom']<=page.height-40,item['name']+' text outside A4 margins')
    subprocess.run([poppler,'-scale-to','1123','-png',str(path),str(visual/item['name'])],check=True,capture_output=True)
    pages.extend(sorted(visual.glob(item['name']+'-*.png')));results.append({'name':item['name'],'pages':len(reader.pages)})
for offset in range(0,len(pages),12):
    chosen=pages[offset:offset+12];board=Image.new('RGB',(1280,((len(chosen)+3)//4)*460),'#e6e7ea');draw=ImageDraw.Draw(board)
    for index,file in enumerate(chosen):
        im=Image.open(file).convert('RGB');im.thumbnail((298,422));x=(index%4)*320+11;y=(index//4)*460
        draw.text((x,y+4),file.stem,fill='black');board.paste(im,(x,y+26))
    board.save(visual/f'writing-board-{offset//12+1}.jpg',quality=92)
(folder/'quality-report.json').write_text(json.dumps({'assertions':count,'exports':results,'failures':[]},indent=2))
print(json.dumps({'assertions':count,'exports':len(results),'failures':[],'page_counts':results}))
