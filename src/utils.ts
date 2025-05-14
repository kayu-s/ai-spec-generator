import * as vscode from "vscode";
import { DEFAULT_PROMPT, EXTENSION_NAME } from "./constants";

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
