"""Render fictional public PDFs for the responsive gallery image generator."""
from pathlib import Path
import json, shutil, subprocess
from pypdf import PdfReader

root=Path(__file__).resolve().parents[1]
destination=root/'tmp/pdfs/template-previews';destination.mkdir(parents=True,exist_ok=True)
poppler=shutil.which('pdftoppm')
if not poppler:raise RuntimeError('pdftoppm is required to render sample previews')
for template in json.loads((root/'public/samples/catalog.json').read_text())['templates']:
    file=root/'public/samples'/(template['id']+'.pdf')
    assert len(PdfReader(file).pages)==1,template['id']+' public sample must fit one page'
    subprocess.run([poppler,'-singlefile','-r','192','-png',str(file),str(destination/template['id'])],check=True,capture_output=True)
print('Rendered 16 sample PDFs at 192 dpi for sharp gallery images.')
