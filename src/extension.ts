// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getAllFilesWithExtensions, parseConfigs } from "./utils";
import { EXTENSION_NAME } from "./constants";

// TODO: 多言語対応
// https://code.visualstudio.com/api/references/vscode-api#l10n

// TODO: 生成対象がなかった時のメッセージ

export function activate(context: vscode.ExtensionContext) {
  console.log(
    `Congratulations, your extension ${EXTENSION_NAME} is now active!`
  );

  // 「extension.generateSpecifications」コマンドを登録
  const generateCommand = vscode.commands.registerCommand(
    `${EXTENSION_NAME}.generateSpecifications`,
    async () => {
      await generateSpecifications();
    }
  );
  const provider = new PromptViewProvider(context);

  const promptEditView = vscode.window.registerWebviewViewProvider(
    PromptViewProvider.viewType,
    provider
  );

  const commands = [generateCommand];
  const views = [promptEditView];

  context.subscriptions.push(...commands, ...views);
}

// This method is called when your extension is deactivated
export function deactivate() {}

class PromptViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = `${EXTENSION_NAME}.promptView`;

  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_NAME}.prompt`)) {
        this.refresh();
      }
    });
  }

  private refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    console.log("webviewView resolved", webviewView);
    this._view = webviewView;

    // Set the HTML content for the Webview
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtmlContent();

    // Handle messages from the Webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "savePrompt":
          this.savePrompt(message.text);
          break;
      }
    });
  }

  private _getHtmlContent(): string {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const prompt = config.get<string>("prompt", "");
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edit Default Prompt</title>
      </head>
      <body>
        <h3>Edit Default Prompt</h3>
        <textarea id="prompt" style="width: 100%; height: 200px;">${prompt}</textarea>
        <button id="saveButton">Save</button>
        <script>
          console.log("Webview loaded");
          const vscode = acquireVsCodeApi();
          document.getElementById('saveButton').addEventListener('click', () => {
            const text = document.getElementById('prompt').value;
            vscode.postMessage({ command: 'savePrompt', text });
          });
        </script>
      </body>
      </html>
    `;
  }

  private savePrompt(newPrompt: string) {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    config.update("prompt", newPrompt, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage("Prompt updated!");
  }
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

    const initialMessage = vscode.LanguageModelChatMessage.User(initialPrompt);

    for (const inputDir of inputDirs) {
      const srcDir = path.join(workspaceFolder, inputDir);

      // Get all files with the specified extensions in the current input directory
      const files = getAllFilesWithExtensions(srcDir, targetExtensions);

      for (const file of files) {
        // Read the file content
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
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      "仕様書の生成に失敗しました: " + String(err)
    );
  }
}
