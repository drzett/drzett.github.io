import './springboard-v14.js';

document.querySelector('meta[name="app-version"]')?.setAttribute('content', '1.4.0');
document.querySelector('meta[name="app-build"]')?.setAttribute('content', '2026-09-11.5');

const SIG_EOCD = 0x06054b50;
const SIG_CDIR = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const decoder = new TextDecoder('utf-8');

function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }

function findEOCD(view) {
  const min = Math.max(0, view.byteLength - 0xFFFF - 22);
  for (let i = view.byteLength - 22; i >= min; i -= 1) {
    if (u32(view, i) === SIG_EOCD) return i;
  }
  throw new Error('Invalid ZIP archive: end-of-central-directory record not found.');
}

function decodeName(bytes, flags) {
  // Bit 11 indicates UTF-8. Most modern archives use it; UTF-8 is also the safest fallback.
  if (flags & 0x0800) return decoder.decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return decoder.decode(bytes); }
}

async function inflateRaw(bytes) {
  if (!('DecompressionStream' in globalThis)) throw new Error('This browser cannot extract deflated ZIP entries.');
  let stream;
  try { stream = new DecompressionStream('deflate-raw'); }
  catch { throw new Error('This browser does not support raw DEFLATE required by this ZIP archive.'); }
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
}

export async function parseZip(arrayBuffer, onProgress = () => {}) {
  const view = new DataView(arrayBuffer);
  const eocd = findEOCD(view);
  const totalEntries = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);

  if (totalEntries === 0xFFFF || centralSize === 0xFFFFFFFF || centralOffset === 0xFFFFFFFF) {
    throw new Error('ZIP64 archives are not supported by this build.');
  }

  const bytes = new Uint8Array(arrayBuffer);
  const entries = [];
  let cursor = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (u32(view, cursor) !== SIG_CDIR) throw new Error('Invalid ZIP archive: central directory is corrupt.');
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const crc32 = u32(view, cursor + 16);
    const compressedSize = u32(view, cursor + 20);
    const uncompressedSize = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    const name = decodeName(nameBytes, flags).replaceAll('\\', '/');
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!name || name.endsWith('/')) continue;
    if (flags & 0x0001) throw new Error(`Encrypted ZIP entry is not supported: ${name}`);
    if (![0, 8].includes(method)) throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
    if (u32(view, localOffset) !== SIG_LOCAL) throw new Error(`Invalid local ZIP header: ${name}`);

    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
    else data = await inflateRaw(compressed);

    if (uncompressedSize !== 0xFFFFFFFF && data.byteLength !== uncompressedSize) {
      throw new Error(`ZIP entry size mismatch: ${name}`);
    }

    entries.push({ name, bytes: data, size: data.byteLength, crc32 });
    onProgress(index + 1, totalEntries, name);
  }

  return entries;
}
