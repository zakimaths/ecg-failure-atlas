"""Rebuild the fixed PTB subset from checksum-pinned, open PhysioNet files."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/ecg_atlas/data'
LEADS = ['i', 'ii', 'iii', 'avr', 'avl', 'avf', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6']


def decode(header, payload):
    """Only the exact format-16, 12-channel PTB .dat layout is supported."""
    lines = header.decode('ascii').splitlines()
    record, channels, fs, count = lines[0].split()
    if (channels, fs) != ('15', '1000') or int(count) < 8000:
        raise ValueError('Unexpected PTB header')
    specs = [line.split() for line in lines[1:13]]
    if any(s[0] != record + '.dat' or s[1:5] != ['16', '2000', '16', '0'] or s[7] != '0' for s in specs):
        raise ValueError('Unsupported encoding or calibration')
    if [s[8] for s in specs] != LEADS or len(payload) != int(count) * 12 * 2:
        raise ValueError('Unexpected channels or byte count')
    samples = np.frombuffer(payload, dtype='<i2').reshape(int(count), 12)
    for i, spec in enumerate(specs):
        if samples[0, i] != int(spec[5]) or int(samples[:, i].sum()) % 65536 != int(spec[6]) % 65536:
            raise ValueError('WFDB initial sample/checksum mismatch')
    if np.any(samples[:8000] == -32768):
        raise ValueError('Missing samples in selected interval')
    return {lead: samples[:8000, i].tolist() for i, lead in enumerate(LEADS)}


def build(cache, download=False):
    lock = json.loads((DATA / 'ptb-source-lock.json').read_text())
    records = []
    for item in lock['records']:
        raw = {}
        for ext, info in item['files'].items():
            path = cache / (item['id'].split('/')[-1] + '.' + ext)
            if not path.exists() and download:
                cache.mkdir(parents=True, exist_ok=True)
                with urlopen(info['url'], timeout=60) as response:
                    path.write_bytes(response.read())
            content = path.read_bytes()
            if hashlib.sha256(content).hexdigest() != info['sha256']:
                raise ValueError('Source checksum mismatch: ' + path.name)
            raw[ext] = content
        records.append({**item, 'digital': decode(raw['hea'], raw['dat'])})
    return {**lock, 'records': records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / 'build/ptb-source')
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        parser.error('Choose a fresh output file')
    result = build(args.cache, args.download)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=True) + '\n')
    print('Verified 3 source records, 36 lead segments; wrote ' + str(args.out))


if __name__ == '__main__':
    main()
