let claimed = false
export function claimAutoDirApply() {
  if (claimed) return false
  claimed = true
  return true
}
export function releaseAutoDirApply() {
  claimed = false
}
