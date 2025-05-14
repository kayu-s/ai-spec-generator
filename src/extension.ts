// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseConfigs } from "./utils";

// TODO: 多言語対応
// https://code.visualstudio.com/api/references/vscode-api#l10n

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "ai-doc-generator" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "ai-doc-generator.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage(
        "Hello World from ai-doc-generator!"
      );
    }
  );
  // 「extension.generateSpecifications」コマンドを登録
  const generateCommand = vscode.commands.registerCommand(
    "ai-doc-generator.generateSpecifications",
    async () => {
      await generateSpecifications();
    }
  );

  context.subscriptions.push(disposable, generateCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}

/**
 * Copilotモデルにプロンプトを送信し、結果を受け取る
 */
/**
 * Recursively get all files with specified extensions in a directory
 */
function getAllFilesWithExtensions(
  srcDir: string,
  extensions: string[]
): string[] {
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
}

async function generateSpecifications() {
  const [model] = await vscode.lm.selectChatModels({
    vendor: "copilot",
    family: "gpt-4o",
  });

  if (!model) {
    vscode.window.showErrorMessage("Copilotモデルが見つかりませんでした。");
    return;
  }

  try {
    // get configs
    const { initialPrompt, targetExtensions, inputDirs, outputDir } =
      parseConfigs();

    const workspaceFolder =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";

    const srcDir = path.join(workspaceFolder, "src");

    const initialMessage = vscode.LanguageModelChatMessage.User(initialPrompt);

    const files = getAllFilesWithExtensions(srcDir, targetExtensions);

    for (const file of files) {
      // TODO: vscode.workspace.fs 使った方が良い？
      // https://code.visualstudio.com/api/references/vscode-api#workspace
      const fileContent = fs.readFileSync(file, "utf8");

      // Create a prompt specific to the current file
      const fileMessage = vscode.LanguageModelChatMessage.User(fileContent);

      // Send the prompt for the current file
      const response = await model.sendRequest(
        [initialMessage, fileMessage],
        {}
      );

      const relativePath = path.relative(workspaceFolder, file);
      const docsFolderPath = path.join(
        workspaceFolder,
        outputDir,
        path.dirname(relativePath)
      );

      // Ensure the docs folder exists
      if (!fs.existsSync(docsFolderPath)) {
        fs.mkdirSync(docsFolderPath, { recursive: true });
      }

      const filePath = path.join(
        docsFolderPath,
        `${path.basename(file, path.extname(file))}.md`
      );

      try {
        // Write the response to a new file
        for await (const fragment of response.text) {
          fs.appendFileSync(filePath, fragment, "utf8");
        }
        vscode.window.showInformationMessage(
          `仕様書が ${filePath} に出力されました。`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `ファイルの書き込みに失敗しました: ${String(err)}`
        );
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      "仕様書の生成に失敗しました: " + String(err)
    );
  }
}
