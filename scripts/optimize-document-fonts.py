"""Development only: python -m pip install fonttools brotli, then run this script.
The server uses the committed WOFF2 assets and needs no Python packages.
"""
from pathlib import Path
from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[1] / 'public' / 'fonts'
for name in ['Inter-Regular', 'Inter-SemiBold', 'DejaVuSerif', 'DejaVuSerif-Bold', 'Lato-Regular', 'Lato-Bold', 'SourceSans3-Regular', 'SourceSans3-Bold', 'EBGaramond-Regular', 'EBGaramond-Bold', 'LibreBaskerville-Regular', 'LibreBaskerville-Bold']:
    original = fonts / (name + '.ttf')
    output = fonts / (name + '.woff2')
    font = TTFont(original)
    font.flavor = 'woff2'
    font.save(output)
    compressed = TTFont(output)
    assert font.getBestCmap() == compressed.getBestCmap(), 'Character coverage changed'
    assert font['hmtx'].metrics == compressed['hmtx'].metrics, 'Glyph widths changed'
    assert font.getGlyphOrder() == compressed.getGlyphOrder(), 'Glyph order changed'
    print(f'{name}: {original.stat().st_size} -> {output.stat().st_size} bytes; coverage and widths verified')
