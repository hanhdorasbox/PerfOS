import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Path resolution: FINANCE_EXCEL_PATH env var → data/finance-tracker.xlsx (local dev)
// On Vercel, use Vercel Blob (blobUrl stored in FinanceWorkbook DB record)
export const WORKBOOK_PATH =
  process.env.FINANCE_EXCEL_PATH ||
  path.join(process.cwd(), 'data', 'finance-tracker.xlsx')

const TMP_PATH = path.join(os.tmpdir(), 'finance-tracker.xlsx')

/** Download workbook from Vercel Blob URL into /tmp and return parsed workbook */
export async function readWorkbookFromBlob(blobUrl: string): Promise<XLSX.WorkBook> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set — cannot download private workbook. ' +
      'Go to Vercel Dashboard → your project → Settings → Environment Variables and verify the token is present.'
    )
  }

  // Use the SDK's get() which correctly sets Authorization: Bearer <token>
  // head() + fetch does NOT work for private blobs — head().downloadUrl is just
  // blobUrl?download=1, not a signed URL, so the fetch still returns 403.
  const { get } = await import('@vercel/blob')
  const result = await get(blobUrl, { access: 'private', token, useCache: false })

  if (!result) {
    throw new Error(
      `Workbook not found in Blob storage (blob returned null). ` +
      `The file may have been deleted. Re-upload your Finance Tracker .xlsx.`
    )
  }

  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(
      `Unexpected Blob storage response (HTTP ${result.statusCode}). ` +
      `Try re-uploading your workbook.`
    )
  }

  // Stream → Buffer
  const reader = result.stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const buffer = Buffer.concat(chunks)

  fs.writeFileSync(TMP_PATH, buffer)
  return XLSX.readFile(TMP_PATH)
}

/**
 * Write workbook to /tmp then upload to Vercel Blob.
 * @param wb - The workbook to save
 * @param pathname - The blob pathname to overwrite (e.g. 'finance-tracker-userId.xlsx')
 * @returns The new blob URL
 */
export async function saveWorkbookToBlob(wb: XLSX.WorkBook, pathname = 'finance-tracker.xlsx'): Promise<string> {
  const { put } = await import('@vercel/blob')
  XLSX.writeFile(wb, TMP_PATH)
  const buffer = fs.readFileSync(TMP_PATH)
  const blob = await put(pathname, buffer, {
    access: 'private', // Blob store is private-only
    addRandomSuffix: false,
  })
  return blob.url
}

export const CATEGORIES = [
  'incomes',
  'bills',
  'subscriptions',
  'expenses',
  'savings & investments',
  'debt',
] as const

export type FinanceCategory = typeof CATEGORIES[number]

/** Convert JS Date to Excel serial number */
export function dateToSerial(date: Date): number {
  return Math.floor(date.getTime() / 86400000) + 25569
}

/** Convert Excel serial to JS Date */
export function serialToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000)
}

/** Get the Excel serial for the 1st day of a month given "YYYY-MM" */
export function monthToSerial(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return dateToSerial(new Date(Date.UTC(y, m - 1, 1)))
}

export function readWorkbook() {
  return XLSX.readFile(WORKBOOK_PATH)
}

export function saveWorkbook(wb: XLSX.WorkBook) {
  XLSX.writeFile(wb, WORKBOOK_PATH)
}

export interface TxRow {
  month: number       // Excel serial for 1st of month
  date: number        // Excel serial for tx date
  description: string
  amount: number
  account: string
  category: string
  subCategory: string
  transferTo: string
}

/** Append transaction rows to Transaction Log sheet */
export function appendTransactions(wb: XLSX.WorkBook, rows: TxRow[]): number[] {
  const sheet = wb.Sheets['Transaction Log']
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]

  // Find first empty row after header (row index 8 = Excel row 9)
  let startRow = 8
  while (startRow < data.length) {
    const row = data[startRow] as unknown[]
    const b = row[1] // col B
    if (b === '' || b === null || b === undefined || b === 0) break
    startRow++
  }

  const excelRows: number[] = []
  rows.forEach((tx, i) => {
    const rowIdx = startRow + i
    const excelRow = rowIdx + 1 // 1-indexed

    // Ensure data array has this row
    while (data.length <= rowIdx) data.push([])
    const row = data[rowIdx] as unknown[]
    while (row.length < 11) row.push('')

    row[1] = tx.month       // B
    row[2] = tx.date        // C
    row[3] = tx.description // D
    row[4] = tx.amount      // E
    row[5] = ''             // F (empty)
    row[6] = tx.account     // G
    row[7] = tx.category    // H
    row[8] = tx.subCategory // I
    row[9] = tx.transferTo  // J

    excelRows.push(excelRow)
  })

  // Write back to sheet
  const newSheet = XLSX.utils.aoa_to_sheet(data as string[][], { cellDates: false })
  // Preserve ref
  newSheet['!ref'] = `A1:BK${startRow + rows.length + 10}`
  wb.Sheets['Transaction Log'] = newSheet

  return excelRows
}

export interface MonthlySummary {
  month: string
  categories: { name: string; budgeted: number; actuals: number; difference: number }[]
  totalRemaining: number
}

/** Read Monthly Summary actuals for a given month */
export function readMonthlySummary(wb: XLSX.WorkBook, month: string): MonthlySummary {
  const sheet = wb.Sheets['Monthly Summary']
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: 0 }) as unknown[][]

  const catRows = [
    { name: 'incomes', rowIdx: 9 },
    { name: 'bills', rowIdx: 10 },
    { name: 'subscriptions', rowIdx: 11 },
    { name: 'expenses', rowIdx: 12 },
    { name: 'savings & investments', rowIdx: 13 },
    { name: 'debt', rowIdx: 14 },
  ]

  const categories = catRows.map(({ name, rowIdx }) => {
    const row = (data[rowIdx] || []) as unknown[]
    return {
      name,
      budgeted: Number(row[2]) || 0,
      actuals: Number(row[4]) || 0,
      difference: Number(row[5]) || 0,
    }
  })

  const totalRow = (data[15] || []) as unknown[]
  return {
    month,
    categories,
    totalRemaining: Number(totalRow[4]) || 0,
  }
}

export interface AnnualData {
  months: string[]
  categories: { name: string; values: number[] }[]
}

/** Read Annual Report totals */
export function readAnnualData(wb: XLSX.WorkBook): AnnualData {
  const sheet = wb.Sheets['Annual Report']
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: 0 }) as unknown[][]

  // Row 17 (idx): headers with month serials in cols 2-13
  const headerRow = (data[17] || []) as unknown[]
  const months: string[] = []
  for (let c = 2; c <= 13; c++) {
    const serial = Number(headerRow[c])
    if (serial > 0) {
      const d = serialToDate(serial)
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    }
  }

  const catRows = [
    { name: 'incomes', rowIdx: 18 },
    { name: 'bills', rowIdx: 19 },
    { name: 'subscriptions', rowIdx: 20 },
    { name: 'expenses', rowIdx: 21 },
    { name: 'savings & investments', rowIdx: 22 },
    { name: 'debt', rowIdx: 23 },
  ]

  const categories = catRows.map(({ name, rowIdx }) => {
    const row = (data[rowIdx] || []) as unknown[]
    const values: number[] = []
    for (let c = 2; c <= 13; c++) values.push(Number(row[c]) || 0)
    return { name, values }
  })

  return { months, categories }
}
