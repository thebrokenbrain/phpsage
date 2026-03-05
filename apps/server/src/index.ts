// This file provides the first HTTP surface of the server: a health endpoint.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8080);

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(port, () => {
  process.stdout.write(`phpsage-server listening on :${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
