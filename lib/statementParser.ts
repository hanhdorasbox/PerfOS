/** Parse CSV bank statements. Handles common Czech/European bank CSV formats. */

export interface ParsedTransaction {
  date: string        // "YYYY-MM-DD"
  description: string
  amount: number      // positive=income, negative=expense
  account?: string
  rawLine?: string
}

/** Detect and parse CSV statement. Returns transactions. */
export function parseCSVStatement(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Try to detect delimiter
  const firstLine = lines[0]
  const delimiter = firstLine.includes(';') ? ';' : ','

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = '' }
      else current += ch
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim())

  // Map common Czech bank CSV headers
  const colMap = {
    date: findCol(headers, ['date', 'datum', 'date of transaction', 'transaction date', 'booking date', 'datum transakce', 'datum pohybu']),
    description: findCol(headers, ['description', 'popis', 'note', 'zpráva pro příjemce', 'poznámka', 'transaction', 'details', 'merchant', 'název protistrany', 'protistrana']),
    amount: findCol(headers, ['amount', 'částka', 'castka', 'debit', 'credit', 'value', 'transaction amount']),
    debit: findCol(headers, ['debit', 'výdej', 'vydej', 'outgoing', 'expense']),
    credit: findCol(headers, ['credit', 'příjem', 'prijem', 'incoming', 'income']),
    account: findCol(headers, ['account', 'účet', 'ucet', 'from account']),
  }

  const transactions: ParsedTransaction[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i])
    if (row.length < 2) continue

    // Parse date
    let dateStr = colMap.date >= 0 ? row[colMap.date] : ''
    dateStr = normalizeDate(dateStr)
    if (!dateStr) continue

    // Parse amount
    let amount = 0
    if (colMap.amount >= 0) {
      amount = parseAmount(row[colMap.amount])
    } else if (colMap.credit >= 0 || colMap.debit >= 0) {
      const credit = colMap.credit >= 0 ? parseAmount(row[colMap.credit]) : 0
      const debit = colMap.debit >= 0 ? parseAmount(row[colMap.debit]) : 0
      amount = credit - Math.abs(debit)
    }

    const description = colMap.description >= 0 ? row[colMap.description] || '' : row[1] || ''
    const account = colMap.account >= 0 ? row[colMap.account] : undefined

    transactions.push({
      date: dateStr,
      description: description.trim(),
      amount,
      account: account?.trim(),
      rawLine: lines[i],
    })
  }

  return transactions
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c))
    if (idx >= 0) return idx
  }
  return -1
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const patterns: { re: RegExp; fn: (m: RegExpMatchArray) => string }[] = [
    { re: /^(\d{2})\.(\d{2})\.(\d{4})/, fn: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { re: /^(\d{2})\/(\d{2})\/(\d{4})/, fn: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { re: /^(\d{4})-(\d{2})-(\d{2})/, fn: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})/, fn: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
  ]
  for (const { re, fn } of patterns) {
    const m = raw.match(re)
    if (m) return fn(m)
  }
  return ''
}

function parseAmount(raw: string): number {
  if (!raw) return 0
  // Remove currency symbols, spaces, and handle Czech number format (1 234,56)
  const cleaned = raw
    .replace(/[Kč€$£]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/\.(?=.*\.)/g, '')  // Remove extra dots (thousands separator), keep last
  return parseFloat(cleaned) || 0
}
