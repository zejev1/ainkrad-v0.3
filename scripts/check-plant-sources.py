"""Independent, read-only source audit. It never changes plant traits or a world.
Usage: python scripts/check-plant-sources.py [--record]
Changed documents require human/agent review and a new catalog revision, not
untrusted remote text becoming simulation code. Uses the checked-in URL manifest.
"""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data' / 'plant-source-audit.json'
ALLOWED = {'www.euforgen.org', 'plants.usda.gov', 'www.woodlandtrust.org.uk'}


def check(row):
    import urllib.parse
    url = row['url']
    if urllib.parse.urlparse(url).hostname not in ALLOWED:
        return {**row, 'status': 'rejected', 'error': 'Source host is not authorized'}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Ainkrad-source-audit/1.0'})
        with urllib.request.urlopen(request, timeout=25) as response:
            body = response.read(5_000_001)
            if len(body) > 5_000_000 or response.status != 200:
                raise ValueError('Unexpected source response')
            digest = hashlib.sha256(body).hexdigest()
            return {**row, 'status': 'verified', 'sha256': digest,
                    'changedSincePreviousFetch': bool(row.get('sha256') and row['sha256'] != digest),
                    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'bytes': len(body)}
    except Exception as error:
        return {**row, 'status': 'unavailable', 'error': str(error)[:180]}


if __name__ == '__main__':
    manifest = json.loads(MANIFEST.read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        rows = list(executor.map(check, manifest['sources']))
    if '--record' in sys.argv:
        manifest['sources'] = rows
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    for row in rows:
        print(row['speciesId'], row['status'], 'changed' if row.get('changedSincePreviousFetch') else '')
    sys.exit(0 if all(row['status'] == 'verified' for row in rows) else 1)
