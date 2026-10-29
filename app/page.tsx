export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Steelmate API</h1>
      <p>REST endpoints live under <code>/api/v1/*</code>.</p>
      <p>
        Health: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
