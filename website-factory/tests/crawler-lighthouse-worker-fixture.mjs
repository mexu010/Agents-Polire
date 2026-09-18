import process from "node:process";
import { URL } from "node:url";

const options = JSON.parse(process.argv[2]);

if (new URL(options.website).pathname === "/hang") {
  await new Promise(() => undefined);
}
