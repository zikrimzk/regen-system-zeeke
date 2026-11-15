"""Create a review collection from actual engine exports. No resume pages are redrawn."""
from pathlib import Path
import json, io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter

root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'public/samples/catalog.json').read_text())['templates']
dest=root/'output/pdf';dest.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('CollectionSans',str(root/'public/fonts/Inter-Regular.ttf')))
pdfmetrics.registerFont(TTFont('CollectionBold',str(root/'public/fonts/Inter-SemiBold.ttf')))
buffer=io.BytesIO();cover=canvas.Canvas(buffer,pagesize=A4)
width,height=A4
cover.setFillColorRGB(.08,.09,.10);cover.setFont('CollectionBold',25);cover.drawString(44,height-70,'ReGen Resume Collection')
cover.setFont('CollectionSans',11);cover.drawString(44,height-94,'Standard and Premium | Design review edition')
cover.setStrokeColorRGB(.1,.35,.27);cover.setLineWidth(1);cover.line(44,height-114,width-44,height-114)
cover.setFont('CollectionSans',10)
for i,line in enumerate(['16 existing designs rebuilt: 12 text-only and 4 dedicated portrait layouts.','11 pt body type, 18 mm margins and embedded professional fonts by default.','Fictional examples rendered by the real export engine. Illustrative sample portrait.']):cover.drawString(44,height-142-i*17,line)
for tier,x in [('basic',44),('premium',310)]:
 y=height-235;cover.setFont('CollectionBold',14);cover.drawString(x,y,('Standard' if tier=='basic' else 'Premium'));y-=28
 for template in [t for t in catalog if t['tier']==tier]:
  number=catalog.index(template)+2
  cover.setFont('CollectionBold',11);cover.drawString(x,y,template['name']+(' / photo' if template.get('photo') else ''));cover.setFont('CollectionSans',10);cover.drawRightString(x+214,y,str(number));y-=16
  cover.setFillColorRGB(.32,.34,.36);cover.setFont('CollectionSans',8.5);cover.drawString(x,y,template['recommendedFor']);cover.setFillColorRGB(.08,.09,.10);y-=26
cover.setFont('CollectionBold',11);cover.drawString(44,178,'Career-stage examples')
senior_pages=len(PdfReader(root/'tmp/pdfs/current/executive-senior.pdf').pages)
cover.setFont('CollectionSans',10);cover.drawString(44,157,'18  Graduate application - one-page example');cover.drawString(44,140,f"19{('-'+str(18+senior_pages)) if senior_pages>1 else ''}  Senior application - {senior_pages}-page example")
cover.setFont('CollectionSans',9);cover.setFillColorRGB(.32,.34,.36);cover.drawString(44,90,'Use the bookmarks to move between designs. Export an individual resume to apply.')
cover.drawString(44,74,'Collection labels prepare future pricing; all designs are currently available.')
cover.showPage();cover.save();buffer.seek(0)
writer=PdfWriter();writer.add_page(PdfReader(buffer).pages[0]);parents={}
for index,template in enumerate(catalog,1):
 reader=PdfReader(root/'public/samples'/(template['id']+'.pdf'))
 assert len(reader.pages)==1,template['id']+' public sample must fit one page'
 writer.add_page(reader.pages[0])
 if template['tier'] not in parents:parents[template['tier']]=writer.add_outline_item(template['tier'].title(),index)
 writer.add_outline_item(template['name'],index,parent=parents[template['tier']])
for title,file in [('Graduate example','graduate-graduate.pdf'),('Senior example','executive-senior.pdf')]:
 index=len(writer.pages);reader=PdfReader(root/'tmp/pdfs/current'/file)
 for page in reader.pages:writer.add_page(page)
 writer.add_outline_item(title,index)
writer.add_metadata({'/Title':'ReGen Resume Collection - Standard and Premium','/Author':'ReGen','/Subject':'Fictional templates and career-stage examples for professional review'})
with (dest/'regen-resume-collection.pdf').open('wb') as f:writer.write(f)
print(f'Review collection saved: {len(writer.pages)} pages.')
