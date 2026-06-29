import type { AdminStatsPeriod } from './admin-dashboard-shared';

export function fetchAdminJson(path: string, token: string, period: AdminStatsPeriod, extraQuery = '', customDates?: { start: string; end: string }): Promise<Response> {
  const params: string[] = [];
  if (customDates) {
    params.push(`startDate=${customDates.start}`, `endDate=${customDates.end}`);
  } else {
    params.push(`period=${period}`);
  }
  if (extraQuery) params.push(extraQuery);
  return fetch(`${path}?${params.join('&')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteLogs(query: string, token: string, onUnauthorized: () => void): Promise<void> {
  const response = await fetch(`/api/admin/logs?${query}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    onUnauthorized();
    return;
  }
  await response.json();
}

export async function exportLogs(query: string, token: string, format: 'csv' | 'json', onUnauthorized: () => void): Promise<void> {
  const response = await fetch(`/api/admin/logs/export?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    onUnauthorized();
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = format === 'csv' ? 'agent-logs.csv' : 'agent-logs.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
