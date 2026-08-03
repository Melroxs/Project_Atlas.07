// apps/web/src/lib/zip-bundle.ts
// Tiny dependency-free ZIP writer — store method (no compression) with CRC32
// checksums and UTF-8 filenames. Enough to bundle the Final Claim Package as
// separate files without pulling in a library. Produces a standard .zip that
// any OS / archive tool can open.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const d =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, date: d };
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

export interface ZipEntry {
  /** Relative filename inside the archive, e.g. "01-executive-summary.md". */
  name: string;
  content: string;
}

/** Build a .zip Blob from the given entries (store method, UTF-8 names). */
export function createZipBlob(entries: ZipEntry[]): Blob {
  const now = new Date();
  const dos = dosDateTime(now);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8(entry.name);
    const data = utf8(entry.content);
    const crc = crc32(data);
    const size = data.length;

    const flags = 0x0800; // UTF-8 filenames
    const local = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // local file header signature
      u16(20), // version needed
      u16(flags),
      u16(0), // store
      u16(dos.time),
      u16(dos.date),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0), // extra length
      nameBytes,
      data,
    ]);
    localParts.push(local);

    const central = concat([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // central directory signature
      u16(20), // version made by
      u16(20), // version needed
      u16(flags),
      u16(0), // store
      u16(dos.time),
      u16(dos.date),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0), // external attrs
      u32(offset), // local header offset
      nameBytes,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDir = concat(centralParts);
  const eocd = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // end of central directory
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return new Blob([concat([...localParts, centralDir, eocd])], { type: 'application/zip' });
}

/** Trigger a browser download of the bundled ZIP. */
export function downloadZip(filename: string, entries: ZipEntry[]): void {
  const blob = createZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
