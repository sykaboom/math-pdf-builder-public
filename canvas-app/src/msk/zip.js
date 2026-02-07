const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const buildCrcTable = () => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
}

const CRC_TABLE = buildCrcTable()

const crc32 = (data) => {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const toDosTimeDate = (date = new Date()) => {
  const dt = date instanceof Date ? date : new Date(date)
  let year = dt.getFullYear()
  if (year < 1980) year = 1980
  const month = dt.getMonth() + 1
  const day = dt.getDate()
  const hours = dt.getHours()
  const minutes = dt.getMinutes()
  const seconds = Math.floor(dt.getSeconds() / 2)
  const dosTime = (hours << 11) | (minutes << 5) | seconds
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosTime, dosDate }
}

const concatUint8Arrays = (chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    output.set(chunk, offset)
    offset += chunk.length
  })
  return output
}

const writeUint16LE = (view, offset, value) => {
  view.setUint16(offset, value, true)
}

const writeUint32LE = (view, offset, value) => {
  view.setUint32(offset, value >>> 0, true)
}

const encodeString = (value) => textEncoder.encode(String(value || ''))
const decodeString = (bytes) => textDecoder.decode(bytes)

const findEndOfCentralDirectory = (data) => {
  const minOffset = Math.max(0, data.length - 65557)
  for (let i = data.length - 22; i >= minOffset; i -= 1) {
    if (
      data[i] === 0x50 &&
      data[i + 1] === 0x4b &&
      data[i + 2] === 0x05 &&
      data[i + 3] === 0x06
    ) {
      return i
    }
  }
  return -1
}

const buildZip = (entries = []) => {
  const fileChunks = []
  const centralChunks = []
  let offset = 0
  const entryList = Array.isArray(entries) ? entries : []

  entryList.forEach((entry) => {
    const nameBytes = encodeString(entry.path)
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data || [])
    const { dosTime, dosDate } = toDosTimeDate(entry.modifiedAt)
    const crc = crc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32LE(localView, 0, 0x04034b50)
    writeUint16LE(localView, 4, 20)
    writeUint16LE(localView, 6, 0x0800)
    writeUint16LE(localView, 8, 0)
    writeUint16LE(localView, 10, dosTime)
    writeUint16LE(localView, 12, dosDate)
    writeUint32LE(localView, 14, crc)
    writeUint32LE(localView, 18, data.length)
    writeUint32LE(localView, 22, data.length)
    writeUint16LE(localView, 26, nameBytes.length)
    writeUint16LE(localView, 28, 0)
    localHeader.set(nameBytes, 30)

    fileChunks.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32LE(centralView, 0, 0x02014b50)
    writeUint16LE(centralView, 4, 20)
    writeUint16LE(centralView, 6, 20)
    writeUint16LE(centralView, 8, 0x0800)
    writeUint16LE(centralView, 10, 0)
    writeUint16LE(centralView, 12, dosTime)
    writeUint16LE(centralView, 14, dosDate)
    writeUint32LE(centralView, 16, crc)
    writeUint32LE(centralView, 20, data.length)
    writeUint32LE(centralView, 24, data.length)
    writeUint16LE(centralView, 28, nameBytes.length)
    writeUint16LE(centralView, 30, 0)
    writeUint16LE(centralView, 32, 0)
    writeUint16LE(centralView, 34, 0)
    writeUint16LE(centralView, 36, 0)
    writeUint32LE(centralView, 38, 0)
    writeUint32LE(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)
    centralChunks.push(centralHeader)

    offset += localHeader.length + data.length
  })

  const centralDirectory = concatUint8Arrays(centralChunks)
  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  writeUint32LE(endView, 0, 0x06054b50)
  writeUint16LE(endView, 4, 0)
  writeUint16LE(endView, 6, 0)
  writeUint16LE(endView, 8, entryList.length)
  writeUint16LE(endView, 10, entryList.length)
  writeUint32LE(endView, 12, centralDirectory.length)
  writeUint32LE(endView, 16, offset)
  writeUint16LE(endView, 20, 0)

  return concatUint8Arrays([...fileChunks, centralDirectory, endRecord])
}

const readZip = (input) => {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input)
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const eocdOffset = findEndOfCentralDirectory(data)
  if (eocdOffset < 0) throw new Error('ZIP end record not found.')

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const centralOffset = view.getUint32(eocdOffset + 16, true)
  let ptr = centralOffset
  const files = new Map()

  for (let i = 0; i < totalEntries; i += 1) {
    const signature = view.getUint32(ptr, true)
    if (signature !== 0x02014b50) throw new Error('ZIP central directory error.')
    const compression = view.getUint16(ptr + 10, true)
    const compressedSize = view.getUint32(ptr + 20, true)
    const nameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const localOffset = view.getUint32(ptr + 42, true)

    const nameBytes = data.slice(ptr + 46, ptr + 46 + nameLen)
    const name = decodeString(nameBytes)

    const localSig = view.getUint32(localOffset, true)
    if (localSig !== 0x04034b50) throw new Error('ZIP local header error.')
    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const dataOffset = localOffset + 30 + localNameLen + localExtraLen
    const fileData = data.slice(dataOffset, dataOffset + compressedSize)

    if (compression !== 0) throw new Error(`ZIP compression not supported: ${compression}`)

    files.set(name, fileData)
    ptr += 46 + nameLen + extraLen + commentLen
  }

  return files
}

export const ZipUtils = {
  buildZip,
  readZip,
}
