import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const copy = res.clone();
      let message = await copy.text();
      if (!message) message = res.statusText;
      throw new Error(`${res.status}: ${message}`);
    } catch {
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

function getAuthHeaders() {
  try {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeaders(),
  };
  // In the browser prefer relative URLs (avoid building absolute URLs) so the request stays same-origin and avoids CORS issues
  const target = typeof window === 'undefined'
    ? (url.toString().startsWith('http') ? url.toString() : `${process.env.SERVER_ORIGIN || ''}${url}`)
    : (url.toString().startsWith('http') ? url.toString() : (url.toString().startsWith('/') ? url : `${window.location.pathname.replace(/\/.*/,'')}${url}`));

  let res: Response;
  try {
    res = await fetch(target as string, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (err) {
    console.error("apiRequest fetch failed:", { method, target, headers, data, error: err });
    throw err;
  }

  // If server returned HTML (eg. index.html) it's likely a misrouted request or an auth redirect.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const text = await res.text();
    const preview = text.slice(0, 300);
    throw new Error(`Expected JSON but received HTML response (status ${res.status}): ${preview}`);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const rel = queryKey.join("/") as string;
    const target = typeof window === 'undefined' ? (rel.startsWith('http') ? rel : `${process.env.SERVER_ORIGIN || ''}${rel}`) : rel;
    const res = await fetch(target as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
