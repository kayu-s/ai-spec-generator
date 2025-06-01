import * as vscode from "vscode";
import { EXTENSION_NAME } from "./constants";
import * as fs from "fs";
import * as path from "path";

export const parseConfigs = () => {
  const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
  const initialPrompt = config.get<string>("prompt");

  const targetExtensions = validateAndGet(
    config.get<string[]>("targetExtensions"),
    "Please make sure your target extension setting"
  );

  const inputDirs = validateAndGet(
    config.get<string[]>("inputDirs"),
    "Please make sure your target folders setting"
  );

  const outputDir = validateAndGet(
    config.get<string>("outputDir"),
    "Please make sure your output folder setting"
  );

  return { initialPrompt, targetExtensions, inputDirs, outputDir };
};

const validateAndGet = <T>(config: T, text: string) => {
  if (!config) {
    console.error(text);
    throw new Error(text);
  }
  return config;
};

/**
 * Recursively get all files with specified extensions in a directory
 */
export const getAllFilesWithExtensions = (
  srcDir: string,
  extensions: string[]
): string[] => {
  let results: string[] = [];

  if (!fs.existsSync(srcDir)) {
    console.error(`Folder you specified does not exist: ${srcDir}`);
    return results;
  }

  const list = fs.readdirSync(srcDir);

  for (const file of list) {
    const filePath = path.join(srcDir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      // Recurse into subdirectory
      results = results.concat(getAllFilesWithExtensions(filePath, extensions));
    } else if (extensions.some((ext) => file.endsWith(ext))) {
      // Add file to results if it matches one of the specified extensions
      results.push(filePath);
    }
  }

  return results;
};

export const getNonce = () => {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
