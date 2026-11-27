"""Bundle Google Fonts with Latin/Vietnamese glyphs and their OFL notices."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from io import BytesIO
from hashlib import sha256
import json
from urllib.request import Request, urlopen
from urllib.parse import quote
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dist/fonts'
FAMILIES = {
    'montserrat': [('Montserrat[wght].ttf', 'montserrat-regular.woff2'), ('Montserrat-Italic[wght].ttf', 'montserrat-italic.woff2')],
    'playfairdisplay': [('PlayfairDisplay[wght].ttf', 'playfair-display-regular.woff2'), ('PlayfairDisplay-Italic[wght].ttf', 'playfair-display-italic.woff2')],
    'cormorantgaramond': [('CormorantGaramond[wght].ttf', 'cormorant-garamond-regular.woff2'), ('CormorantGaramond-Italic[wght].ttf', 'cormorant-garamond-italic.woff2')],
    'patrickhand': [('PatrickHand-Regular.ttf', 'patrick-hand.woff2')],
}
UNICODES = set(range(0x20, 0x250)) | set(range(0x300, 0x370)) | set(range(0x1E00, 0x1F00)) | set(range(0x2000, 0x2070)) | set(range(0x20A0, 0x20D0))
VIETNAMESE = set(map(ord, 'aáàảãạăắằẳẵặâấầẩẫậeéèẻẽẹêếềểễệiíìỉĩịoóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữựyýỳỷỹỵđ' + 'AÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬEÉÈẺẼẸÊẾỀỂỄỆIÍÌỈĨỊOÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢUÚÙỦŨỤƯỨỪỬỮỰYÝỲỶỸỴĐ'))

def fetch(url):
    return urlopen(Request(url, headers={'User-Agent': 'RAY-PHOTO-font-bundle'}), timeout=45).read()

def family(item):
    name, files = item
    base = 'https://raw.githubusercontent.com/google/fonts/main/ofl/' + name + '/'
    license_bytes = fetch(base + 'OFL.txt')
    if b'SIL OPEN FONT LICENSE' not in license_bytes:
        raise ValueError('Missing OFL notice: ' + name)
    (DEST / (name + '-OFL.txt')).write_bytes(license_bytes)
    result = []
    for filename, output in files:
        url = base + quote(filename)
        raw = fetch(url)
        font = TTFont(BytesIO(raw))
        missing = VIETNAMESE - set(font.getBestCmap())
        if missing:
            raise ValueError(f'{name} lacks Vietnamese glyphs: {missing}')
        options = subset.Options()
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        font.flavor = 'woff2'
        target = DEST / output
        font.save(target)
        font.close()
        result.append({'file': output, 'source': url, 'sha256': sha256(raw).hexdigest(), 'bytes': len(raw), 'woff2_bytes': target.stat().st_size, 'subset': 'Latin, Latin Extended, combining marks, Vietnamese, punctuation, currency'})
    return result

if __name__ == '__main__':
    DEST.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = [row for group in pool.map(family, FAMILIES.items()) for row in group]
    sources = DEST / 'sources.json'
    old = json.loads(sources.read_text())
    names = {r['file'] for r in rows}
    sources.write_text(json.dumps([r for r in old if r['file'] not in names] + rows, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'font_files': len(rows), 'woff2_bytes': sum(r['woff2_bytes'] for r in rows), 'files': rows}, ensure_ascii=False), flush=True)
