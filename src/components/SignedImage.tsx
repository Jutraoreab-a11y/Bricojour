'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignedImage({ bucket, path, alt, className = '' }: {
  bucket: string; path: string; alt: string; className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    createClient().storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl ?? null)
    })
    return () => { alive = false }
  }, [bucket, path])

  if (!url) return <div className={`animate-pulse bg-line ${className}`} aria-hidden />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className={`object-cover ${className}`} />
    </a>
  )
}
