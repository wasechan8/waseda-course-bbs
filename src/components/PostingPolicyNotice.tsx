import { Link } from 'react-router-dom'

export function PostingPolicyNotice() {
  return (
    <p className="posting-policy-notice">
      投稿すると<Link to="/guide">利用規約</Link>に同意したものとみなします。
    </p>
  )
}
