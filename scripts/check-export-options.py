"""Check optional export settings and render the review collection with Poppler."""
from pathlib import Path
import shutil, subprocess, re
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[1]
destination=root/'tmp/pdfs/review';destination.mkdir(parents=True,exist_ok=True)
poppler=shutil.which('pdftoppm')
if not poppler: raise RuntimeError('pdftoppm is required for visual review')
for name in ['unicode-sans','unicode-serif','legacy-arial','optional-photo','all-sections-sans','all-sections-serif','font-sans','font-serif','font-source','font-lato','font-garamond','font-baskerville','photo-left-portrait','photo-left-square','photo-right-portrait','photo-right-square','photo-ignored-text','missing-photo-left','long-photo-header','custom-layout']:
    path=root/'tmp/pdfs/options'/(name+'.pdf')
    reader=PdfReader(path);text=''.join(p.extract_text() or '' for p in reader.pages)
    assert 'Anaïs O’Connor Muñoz' in ' '.join(text.split()),path.name+' lost accented name'
    assert 'São Paulo, Brazil' in text,path.name+' lost accented location'
    assert text.casefold().index('anaïs')<text.casefold().index('summary'),path.name+' incorrect reading order'
    assert '\ufffd' not in text,path.name+' replacement characters'
    if path.stem=='optional-photo' or (path.stem.startswith('photo-') and path.stem!='photo-ignored-text'):assert len(reader.pages[0].images)==1,'Optional photo not rendered'
    if path.stem in ['photo-ignored-text','missing-photo-left']:assert len(reader.pages[0].images)==0,'Text-only design displayed a legacy photo'
    if path.stem.startswith('all-sections'):
        for value in ['Grade: First Class Honours','Process mapping, service design','Community Learning Centre','Volunteer Coordinator','Jamie Lim','jamie.lim@example.com','Reusable reporting and documentation templates.']:
            assert value.casefold() in text.casefold(),path.name+' lost optional section text: '+value
    with pdfplumber.open(path) as document:
        expected_family={'font-sans':'Inter','font-source':'SourceSans3','font-lato':'Lato','font-garamond':'EBGaramond','font-baskerville':'LibreBaskerville','font-serif':'DejaVuSerif'}.get(path.stem)
        if expected_family: assert all(expected_family in char['fontname'].replace(' ','') for page in document.pages for char in page.chars), path.name+' did not use the selected font'
        if path.stem.startswith('photo-') and path.stem!='photo-ignored-text':
            page=document.pages[0];portrait=page.images[0]
            assert abs((portrait['x1']-portrait['x0'])-60)<1, path.name+' unexpected portrait width'
            assert abs((portrait['bottom']-portrait['top'])-(60 if path.stem.endswith('square') else 80))<1,path.name+' distorted image frame'
            words=page.extract_words();name=next(w for w in words if 'Anaïs' in w['text'])
            if 'left' in path.stem: assert portrait['x1']<name['x0'],path.name+' photo did not move left'
            else: assert portrait['x0']>name['x1'],path.name+' photo did not move right'
        for page in document.pages:
            for word in page.extract_words():
                assert word['x0']>=35 and word['x1']<page.width-35 and word['top']>=35 and word['bottom']<page.height-35,path.name+' text outside margins'
            if path.stem.startswith('all-sections'):
                family='Inter' if path.stem.endswith('sans') else 'EBGaramond'
                assert all(family in char['fontname'] for char in page.chars),path.name+' unexpected fallback font'
    subprocess.run([poppler,'-scale-to','1123','-png',str(path),str(destination/path.stem)],check=True,capture_output=True)
collection=root/'output/pdf/regen-resume-collection.pdf'
reader=PdfReader(collection)
assert len(reader.pages)>=19,'Expected the design collection and career-stage examples'
for page in reader.pages:assert len((page.extract_text() or '').strip())>80,'Blank review page'
subprocess.run([poppler,'-scale-to','1123','-png',str(collection),str(destination/'collection')],check=True,capture_output=True)
files=sorted(destination.glob('collection-*.png'))
for offset in range(0,len(files),12):
    selected=files[offset:offset+12];board=Image.new('RGB',(1280,round(len(selected)/4+.49)*460),'#e6e7ea');draw=ImageDraw.Draw(board)
    for index,file in enumerate(selected):
        im=Image.open(file).convert('RGB');im.thumbnail((298,422))
        x=(index%4)*320+11;y=(index//4)*460
        draw.text((x,y+5),file.stem,fill='black');board.paste(im,(x,y+27))
    board.save(destination/f'collection-board-{offset//12+1}.jpg',quality=92)
print('20 export-option cases and the review collection passed. All pages rendered.')
