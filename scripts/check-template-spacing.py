"""Check actual text/image rectangles, allowing aligned titles and dates on the same row."""
from pathlib import Path
import json
import pdfplumber

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / 'public/samples/catalog.json').read_text())['templates']
files = [root / 'public/samples' / (t['id'] + '.pdf') for t in catalog]
samples = set(files)
photo_samples = {t['id'] for t in catalog if t['photo']}
files += sorted((root / 'tmp/pdfs/options').glob('*.pdf'))
failures, page_count = [], 0

def intersection(a, b):
    return min(a['x1'], b['x1']) - max(a['x0'], b['x0']) > .5 and min(a['bottom'], b['bottom']) - max(a['top'], b['top']) > .5

for path in files:
    with pdfplumber.open(path) as document:
        for number, page in enumerate(document.pages, 1):
            page_count += 1
            if path in samples and number == 1:
                if path.stem in photo_samples and len(page.images) != 1:
                    failures.append(f"{path.name}: sample portrait did not render")
                text = page.extract_text_lines(x_tolerance=1, y_tolerance=4, return_chars=False)
                for title, date in [('Operations Specialist', 'Jun 2022 - Present'),
                                    ('Project Coordinator', 'Jul 2020 - May 2022'),
                                    ('Bachelor of Business Administration', 'Sep 2016 - Jun 2020')]:
                    if not any(title in line['text'] and date in line['text'] for line in text):
                        failures.append(f"{path.name}: date must share the row with {title}")
            if path.stem == 'long-photo-header' and number == 1 and len(page.images) != 1:
                failures.append(f"{path.name}: long masthead portrait did not render")
            active = []
            for word in sorted(page.extract_words(x_tolerance=1, y_tolerance=3), key=lambda w: (w['top'], w['x0'])):
                active = [other for other in active if other['bottom'] > word['top'] + .5]
                for other in active:
                    if intersection(word, other):
                        failures.append(f"{path.name}, page {number}: {other['text']} / {word['text']}")
                for portrait in page.images:
                    if intersection(word, portrait):
                        failures.append(f"{path.name}, page {number}: text intersects portrait: {word['text']}")
                active.append(word)

report = {'documents': len(files), 'pages': page_count, 'overlap_failures': failures}
(root / 'tmp/pdfs/spacing-overlap-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
print(json.dumps(report, indent=2))
raise SystemExit(1 if failures else 0)
