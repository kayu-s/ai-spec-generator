import * as vscode from "vscode";
import { DEFAULT_PROMPT, EXTENSION_NAME } from "./constants";
import * as fs from "fs";
import * as path from "path";

export const parseConfigs = () => {
  const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
  const initialPrompt = config.get<string>("prompt") || DEFAULT_PROMPT;

  const targetExtensions = validateAndGet(
    config.get<string[]>("targetExtensions"),
    "対象の拡張子を設定してください"
  );

  const inputDirs = validateAndGet(
    config.get<string[]>("inputDirs"),
    "入力対象フォルダを設定してください"
  );

  const outputDir = validateAndGet(
    config.get<string>("outputDir"),
    "出力対象フォルダを設定してください"
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
    console.error(`指定されたディレクトリが存在しません: ${srcDir}`);
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
