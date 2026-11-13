import {readFile} from "node:fs/promises";
import {pool} from "./pool.js"

const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf-8");

console.log(import.meta.url);
console.log(new URL("./schema.sql", import.meta.url));

try {
    await pool.query(sql);
    console.log("Schema is up to date");
} catch (error) {
    console.error("x Migration failed", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}