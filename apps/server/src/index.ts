// This file composes server dependencies and starts the HTTP API.
import { resolve } from "node:path";
import { RunService } from "./application/run-service.js";
import { FileRunRepository } from "./infrastructure/file-run-repository.js";
import { RunSourceReader } from "./infrastructure/run-source-reader.js";
import { createHttpServer } from "./interfaces/http-server.js";

const port = Number(process.env.PORT ?? 8080);
const runsDirectoryPath = resolve(process.cwd(), "data/runs");

const runRepository = new FileRunRepository(runsDirectoryPath);
const runService = new RunService(runRepository);
const runSourceReader = new RunSourceReader();
const server = createHttpServer(runService, runSourceReader);

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
