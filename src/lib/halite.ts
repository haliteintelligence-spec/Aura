type ConsumerEventType =
  | 'OUTCOME_LOGGED'
  | 'TRANSACTION_COMPLETED'
  | 'PREFERENCE_UPDATED'
  | 'PRODUCT_TRACKED'

export async function pushEventToHalite(payload: {
  userId: string
  brandId: string
  type: ConsumerEventType
  data: Record<string, unknown>
  occurredAt?: string
}) {
  const url = process.env.HALITE_INTERNAL_URL
  if (!url) return

  await fetch(`${url}/internal/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
