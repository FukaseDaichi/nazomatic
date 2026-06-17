import fs from "fs";
import path from "path";
import { format } from "util";

export async function runWithLocalLog({ cwd, logPrefix, command }, task) {
  const startedAt = new Date();
  const logPath = createLogPath(cwd, logPrefix, startedAt);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const stream = fs.createWriteStream(logPath, { flags: "a" });
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const writeLine = (line) => {
    stream.write(`${line}\n`);
  };
  const writeConsoleLine = (args) => {
    writeLine(format(...args));
  };

  writeLine(`started_at=${formatJstDateTime(startedAt)}`);
  writeLine(`command=${command}`);

  console.log = (...args) => {
    originalLog(...args);
    writeConsoleLine(args);
  };
  console.error = (...args) => {
    originalError(...args);
    writeConsoleLine(args);
  };
  console.warn = (...args) => {
    originalWarn(...args);
    writeConsoleLine(args);
  };

  let exitStatus = 0;
  try {
    await task();
  } catch (error) {
    exitStatus = 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    writeLine(`finished_at=${formatJstDateTime(new Date())}`);
    writeLine(`exit_status=${exitStatus}`);
    await closeStream(stream);
  }

  return exitStatus;
}

function createLogPath(cwd, logPrefix, date) {
  return path.join(cwd, "log", `${logPrefix}-${formatJstFileStamp(date)}-jst.log`);
}

function formatJstFileStamp(date) {
  const parts = getJstParts(date);
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function formatJstDateTime(date) {
  const parts = getJstParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

function getJstParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
