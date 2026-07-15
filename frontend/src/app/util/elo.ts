export function eloColor(elo: number): string {
  if (elo >= 2000) return '#ff4444';
  if (elo >= 1800) return '#ff6600';
  if (elo >= 1600) return '#aa44ff';
  if (elo >= 1400) return '#4488ff';
  if (elo >= 1200) return '#22c55e';
  if (elo >= 1000) return '#eab308';
  return '#a0724a';
}

export function eloLabel(elo: number): string {
  if (elo >= 2000) return 'Grandmaster';
  if (elo >= 1800) return 'Master';
  if (elo >= 1600) return 'Diamond';
  if (elo >= 1400) return 'Platinum';
  if (elo >= 1200) return 'Gold';
  if (elo >= 1000) return 'Silver';
  return 'Bronze';
}
