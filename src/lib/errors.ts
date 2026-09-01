export function getErrorMessage(error: unknown, fallback: string) {
  const normalize = (message: string) => {
    if (message.includes('15秒に1回')) return '投稿は15秒に1回までです。少し待ってからもう一度お試しください。'
    if (message.includes('同じ内容は続けて投稿')) return '同じ内容は続けて投稿できません。'
    if (message.includes('admin access required')) return '管理者権限がありません。'
    return message
  }

  if (error instanceof Error && error.message) return normalize(error.message)

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return normalize(message)
  }

  return fallback
}
