#!/usr/bin/env python3
"""Apply only the exact tested patch to the exact baseline, fail closed."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

BASE = 'b3bfd24aaff1a80c54abd3bfdc370395dc85631e'
PATCH_SHA256 = 'ee920a320769f69da9bb48d5e3e51f9b15193949b71c258d73a032a8c6ab6e45'
repo = Path(sys.argv[1]).resolve()
inputs = Path(__file__).resolve().parent

def git(*args, capture=False):
    return subprocess.run(['git', *args], cwd=repo, check=True,
                          text=True, capture_output=capture)

assert git('rev-parse', 'HEAD', capture=True).stdout.strip() == BASE, 'Unexpected source head'
assert not git('status', '--porcelain', capture=True).stdout.strip(), 'Dirty source checkout'
encoded = ''.join((inputs / f'life-continuity.{i}.b64').read_text().strip() for i in (1, 2, 3))
patch = gzip.decompress(base64.b64decode(encoded, validate=True))
assert hashlib.sha256(patch).hexdigest() == PATCH_SHA256, 'Repair payload checksum mismatch'
manifest = json.loads((inputs / 'manifest.json').read_text())
assert len(manifest) == 17, 'Unexpected manifest size'
assert all(not p.startswith('/') and '..' not in Path(p).parts and p.startswith(('src/', 'tests/', 'docs/')) for p in manifest), 'Invalid path'
with tempfile.TemporaryDirectory() as directory:
    file = Path(directory) / 'repair.patch'
    file.write_bytes(patch)
    paths = [line.split('\t', 2)[2] for line in git('apply', '--numstat', str(file), capture=True).stdout.splitlines()]
    assert set(paths) == set(manifest), 'Unexpected patch scope'
    git('apply', '--check', str(file))
    git('apply', str(file))
for path, digest in manifest.items():
    assert hashlib.sha256((repo / path).read_bytes()).hexdigest() == digest, f'File mismatch: {path}'
git('add', '--', *sorted(manifest))
git('diff', '--cached', '--check')
print(f'Verified {len(manifest)} files, base {BASE}, patch SHA-256 {PATCH_SHA256}')
