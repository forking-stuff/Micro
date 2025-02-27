import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import express from 'express'
import fs from "fs";
import path from "path";
import date from 'date-and-time'
import { getDataHome } from 'platform-folders'
import { getLocalCommitSha } from "../updater"

const dateFormat = "HH:mm:ss DD/MM/YYYY"
const fileDateFormat = "HH-mm-ss_DD-MM-YYYY"
const serverStartDate = new Date()

namespace server {
  export async function log (message: string, options?: {type?: "info" | "warn" | "error", name?: string, exits?: number, error?: Error, logInFile?: boolean}) {
    const appDataLoc = path.join(getDataHome(), `/micro-backend`);
    const logsDir = path.join(appDataLoc, "/logs")
    const callerLocArr = getCallerPath(1)?.split("\\") as Array<String>;
    const callerFile = callerLocArr[callerLocArr.length - 1] || "unknown";
    const callerName = options?.name;
    const type = options?.type || "info";
    const dateNow = new Date();
    const fullMessage = `[${type.toUpperCase()} | ${callerName ? callerName + "/" : ""}${callerFile}](${date.format(dateNow, `${dateFormat}`, true)}): ${message}`;
  
    console.log(fullMessage)
    if (options?.logInFile === undefined || options?.logInFile === true) {
      try {
        if (!fs.existsSync(appDataLoc)) fs.mkdirSync(appDataLoc)
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir)
        const logLoc = path.join(logsDir, `/${date.format(serverStartDate, `[${(await getLocalCommitSha()).slice(0, 7)}] ${fileDateFormat}`, true)}.txt`);
        await new Promise((res, rej) => {
          fs.appendFile(
            logLoc, 
            fullMessage + "\n", 
            (err) => {
              if (err) console.log(err);
    
              if (options?.error) fs.appendFile(
                logLoc,
                options.error.message,
                (err) => {
                  if (err) console.log(err);
    
                  res(null)
                }
              )
              else res(null)
            }
          )
        })
      } catch (e) {
        console.log("Couldn't append to log file\n" + e)
      }
    }
    
    if (options?.exits) process.exit(options.exits);
  }

  export async function error (res: express.Response, status: number, errors: String[]) {
    const error = {
      errors
    }
    res.status(status).json(error)
  }

  /**
   * @description Runs a new child process with the specified command
   */
  export async function sh(command: string): Promise<string> {
    return new Promise((res, rej) => {
      exec(command, (err, stdOut, stdErr) => {
        if (err) rej(err);
        if (stdErr) rej(new Error(stdErr.trim()));
        res(stdOut.trim());
      });
    })
  }

  /**
   * @description Spawns a new process with the specified command
   */
  export async function sp(command: string, detached?: boolean): Promise<ChildProcessWithoutNullStreams> {
    return new Promise((res, rej) => {
      const child = spawn(command, {detached});
      child.unref()
      res(child)
    })
  }

  export function argv (argv: Array<string>, filter?: Array<string>): ServerArgs {
    const command = argv[0];
    const file = argv[1];
    const staleArgs = argv.slice(2);
    var args: Array<ServerArgument> = [];
    var env: Array<string> = []
    var discardLast = false;

    for (const arg of staleArgs) {
      if (arg.startsWith("--")) {
        if (discardLast) {args.pop(); discardLast = false};
        if (filter?.find(a => a === arg.slice(2)) === undefined) discardLast = true;
        args.push({arg: arg.slice(2), data: []})
      }
      else if (args.length > 0) args[args.length - 1].data.push(arg)
      else env.push(arg)
    }

    return {command, file, env, args}
  }
}

export default server

function getCallerPath(depth: number) {
  let stack = new Error().stack?.split('\n') as Array<String>
  return stack[2 + depth].slice(
    stack[2 + depth].lastIndexOf('(') + 1, 
    stack[2 + depth].lastIndexOf('.ts') + 3
  )
}

interface ServerArgs {
  command: string,
  file: string,
  env: Array<string>,
  args: Array<ServerArgument>
}

interface ServerArgument {
  arg: string,
  data: Array<string>
}