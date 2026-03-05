// This file tests PHPStan JSON parser behavior for valid and invalid payloads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePhpstanJsonOutput } from "./phpstan-parser.js";

test("parses valid phpstan payload into issues", () => {
  const raw = JSON.stringify({
    files: {
      "/workspace/examples/php-sample/src/Broken.php": {
        messages: [
          {
            line: 7,
            message: "Undefined variable: $undefinedVariable",
            identifier: "variable.undefined"
          }
        ]
      }
    }
  });

  const issues = parsePhpstanJsonOutput(raw);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0], {
    file: "/workspace/examples/php-sample/src/Broken.php",
    line: 7,
    message: "Undefined variable: $undefinedVariable",
    identifier: "variable.undefined"
  });
});

test("returns empty list for empty or malformed payload", () => {
  assert.deepEqual(parsePhpstanJsonOutput(""), []);
  assert.deepEqual(parsePhpstanJsonOutput("{not-json"), []);
  assert.deepEqual(parsePhpstanJsonOutput(JSON.stringify({ totals: { errors: 0 } })), []);
});

test("defaults missing line to one and skips invalid messages", () => {
  const raw = JSON.stringify({
    files: {
      "file-a.php": {
        messages: [
          { message: "Message without line" },
          { line: 3 },
          null
        ]
      }
    }
  });

  const issues = parsePhpstanJsonOutput(raw);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].line, 1);
  assert.equal(issues[0].message, "Message without line");
});
