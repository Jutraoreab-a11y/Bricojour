import { NextResponse } from 'next/server'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })

export function errorMessage(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Une erreur est survenue.'
}
