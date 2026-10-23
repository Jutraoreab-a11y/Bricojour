'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SignedImage from '@/components/SignedImage'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage } from '@/lib/types'

export default function ChatRoom({ chatId, userId, initial, closesAt, otherName, subtitle, backHref }: {
  chatId: string; userId: string; initial: ChatMessage[]; closesAt: string | null
  otherName: string; subtitle: string; backHref: string
}) {
  const [messages, setMessages] = useState(initial)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const closed = !!closesAt && new Date(closesAt) <= new Date()

  const add = (msg: ChatMessage) => setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]))

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        (p) => add(p.new as ChatMessage))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [chatId])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function send(body: string | null, photo: string | null) {
    setSending(true); setError('')
    const { data, error: err } = await createClient()
      .from('chat_messages')
      .insert({ chat_id: chatId, sender_id: userId, body, photo_path: photo })
      .select()
      .single()
    setSending(false)
    if (err || !data) { setError(closed ? 'La discussion est fermée.' : 'Message non envoyé. Réessayez.'); return false }
    add(data as ChatMessage)
    return true
  }

  async function sendPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setError('Photo trop lourde : 8 Mo maximum.'); return }
    setSending(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await createClient().storage.from('chat-photos').upload(path, file, { contentType: file.type })
    if (upErr) { setSending(false); setError('Photo non envoyée.'); return }
    await send(null, path)
  }

  return (
    <div className="flex h-dvh flex-col bg-concrete">
      <header className="flex items-center gap-3 border-b border-line bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Link href={backHref} aria-label="Retour" className="grid h-10 w-10 place-items-center rounded-full bg-concrete text-lg">‹</Link>
        <div className="min-w-0">
          <p className="truncate font-bold">{otherName}</p>
          <p className="truncate text-xs text-mute">{subtitle}</p>
        </div>
      </header>

      {closesAt && (
        <p className="bg-hiviz px-4 py-2 text-center text-xs font-semibold">
          {closed ? 'Discussion fermée' : `Discussion ouverte jusqu’au ${new Date(closesAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
        </p>
      )}

      <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <li className="py-10 text-center text-sm text-mute">Présentez-vous et précisez l’accès (code, étage, stationnement).</li>}
        {messages.map((m) => {
          const mine = m.sender_id === userId
          return (
            <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-[18px] px-4 py-2 text-[15px] ${mine ? 'rounded-br-[6px] bg-ink text-white' : 'rounded-bl-[6px] bg-white'}`}>
                {m.photo_path && <SignedImage bucket="chat-photos" path={m.photo_path} alt="Photo envoyée" className="mb-1 h-48 w-56 rounded-[12px]" />}
                {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/60' : 'text-mute'}`}>
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </li>
          )
        })}
        <div ref={bottom} />
      </ol>

      {error && <p className="mx-4 mb-2 rounded-[10px] bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>}

      {!closed && (
        <form
          className="flex items-end gap-2 border-t border-line bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const body = text.trim()
            if (!body) return
            if (await send(body, null)) setText('')
          }}
        >
          <label className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-concrete" aria-label="Envoyer une photo">
            <input type="file" accept="image/*" className="sr-only" onChange={sendPhoto} disabled={sending} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </label>
          <textarea rows={1} className="field max-h-32 min-h-12 resize-none py-3" placeholder="Votre message"
            value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-hiviz font-bold" disabled={sending || !text.trim()} aria-label="Envoyer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      )}
    </div>
  )
}
