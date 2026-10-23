import { STATUS_LABEL, statusTone } from '@/lib/status'
import type { MissionStatus } from '@/lib/types'

export default function StatusChip({ status }: { status: MissionStatus }) {
  return <span className={`chip ${statusTone(status)}`}>{STATUS_LABEL[status]}</span>
}
