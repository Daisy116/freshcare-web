import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadAdminTicketsCsv, getAdminTicketsCsvFilename } from '../src/utils/adminTicketCsv'

describe('admin ticket CSV download', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the requested filename date', () => {
    expect(getAdminTicketsCsvFilename(new Date(2026, 10, 26))).toBe('FreshCare_Tickets_20261126.csv')
  })

  it('downloads the server-provided Blob without rebuilding its contents', () => {
    const blob = new Blob(['n8n generated CSV'], { type: 'text/csv' })
    const click = vi.fn()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchor = document.createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(click)
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadAdminTicketsCsv(blob, 'FreshCare_Tickets_20261126.csv')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('FreshCare_Tickets_20261126.csv')
  })
})
