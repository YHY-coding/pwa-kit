#!/usr/bin/env python3
"""アイコン3枚(192・512・180px)を作る。追加の部品は要らない(標準の機能だけでPNGを書く)。

使い方: make-icons.py <出力フォルダ> [--color '#2f5d50']
絵柄は、地の色の上に罫線3本。文字は入れない。別の絵にしたいときは、同じ名前のPNGで置き換える。
"""
import argparse, os, re, struct, sys, zlib

PAPER = (244, 241, 234)

def png(size, bg):
    def bar(y0, x1):  # 罫線1本ぶんの範囲(割合)
        return (0.22, x1, y0, y0 + 0.075)
    bars = [bar(0.30, 0.78), bar(0.4625, 0.78), bar(0.625, 0.52)]
    rows = []
    for y in range(size):
        fy = y / size
        row = bytearray([0])
        for x in range(size):
            fx = x / size
            on = any(a <= fx < b and c <= fy < d for a, b, c, d in bars)
            row += bytes(PAPER if on else bg)
        rows.append(bytes(row))
    def chunk(kind, data):
        c = kind + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
            + chunk(b'IEND', b''))

def main():
    ap = argparse.ArgumentParser(description='PWAのアイコン3枚を作る')
    ap.add_argument('outdir')
    ap.add_argument('--color', default='#2f5d50', help='地の色(#rrggbb)')
    a = ap.parse_args()
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', a.color):
        sys.exit('色は #rrggbb の形で指定する')
    bg = tuple(int(a.color[i:i + 2], 16) for i in (1, 3, 5))
    os.makedirs(a.outdir, exist_ok=True)
    for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
        with open(os.path.join(a.outdir, name), 'wb') as f:
            f.write(png(size, bg))
        print('作成:', os.path.join(a.outdir, name))

if __name__ == '__main__':
    main()
