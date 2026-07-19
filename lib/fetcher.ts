// Shared SWR fetcher. Throws with a `status` field so callers can branch on
// HTTP status (401 → redirect to login, etc.).
export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw Object.assign(new Error('api_error'), { status: r.status });
    return r.json();
  });
