import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // Simple connectivity check: try to read one row from `cities`.
  // This table exists in the locked schema, so a real Supabase project
  // with migrations run should return a row. If it errors, we show why.
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-4">
        <h1 className="text-2xl font-semibold">Livon — Step 1: Connection Test</h1>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Supabase query failed</p>
            <p className="mt-1 font-mono text-xs break-all">{error.message}</p>
            <p className="mt-2 text-red-700">
              Check that <code>.env.local</code> has your real Supabase URL/anon
              key, and that the <code>cities</code> table exists (migrations run).
            </p>
          </div>
        )}

        {!error && !data && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            <p className="font-medium">Connected, but no rows found</p>
            <p className="mt-1">
              The connection to Supabase works — the <code>cities</code> table
              is just empty. Insert one row to see it appear here.
            </p>
          </div>
        )}

        {data && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            <p className="font-medium">✅ Connected to Supabase</p>
            <pre className="mt-2 overflow-x-auto rounded bg-white/60 p-3 text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
