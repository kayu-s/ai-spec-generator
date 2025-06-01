// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getAllFilesWithExtensions, getNonce, parseConfigs } from "./utils";
import { DEFAULT_PROMPT, EXTENSION_NAME } from "./constants";

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

  constructor(private readonly context: vscode.ExtensionContext) {}

  private refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlContent(this._view.webview);
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    // Handle messages from the Webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "savePrompt":
          this.savePrompt(message.text);
          break;
        case "resetPrompt":
          this.resetPrompt();
          break;
        case "generateExecute":
          generateSpecifications();
          break;
      }
    });
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const prompt = config.get<string>("prompt", "");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js")
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "vscode.css")
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "main.css")
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edit Default Prompt</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=refresh,save,smart_toy" />
        <link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <div id="edit-prompt" class="mb-4">
          <h3 class="mt-2">Edit Default Prompt</h3>
          <textarea id="prompt" class="my-2 card w-full h-48 rounded-md">${prompt}</textarea>
          <div class="flex gap-2 justify-end [&_button]:flex [&_button]:gap-2 [&_button]:place-items-center">
            <button id="resetButton" class="w-auto text-white bg-gray-600 hover:bg-gray-700 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2"><span class="material-symbols-outlined">
  refresh
  </span>Reset</button>
            <button id="saveButton" class="w-auto text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none"><span class="material-symbols-outlined">
    save
    </span>Save</button>
          </div>
        </div>
        <div id="execute generate doc">
          <button id="executeButton" class="!text-lg flex gap-2 place-items-center place-content-center w-full m-auto text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none"><span class="material-symbols-outlined">
smart_toy
</span>generate specifications</button>
        </div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  private savePrompt(newPrompt: string) {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    config.update("prompt", newPrompt, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage("Prompt updated!");
    this.refresh();
  }
  private resetPrompt() {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const langKey = vscode.env.language;
    const prompt =
      langKey === "ja" ? DEFAULT_PROMPT[langKey] : DEFAULT_PROMPT["en"];
    config.update("prompt", prompt, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage("Prompt has been reset!");
    this.refresh();
  }
}

async function generateSpecifications() {
  const [model] = await vscode.lm.selectChatModels({
    vendor: "copilot",
    family: "gpt-4o",
  });

  if (!model) {
    vscode.window.showErrorMessage("Copilot model not found");
    return;
  }

  try {
    // get configs
    const { initialPrompt, targetExtensions, inputDirs, outputDir } =
      parseConfigs();

    if (!initialPrompt) {
      vscode.window.showErrorMessage("Please make sure your prompt");
      return;
    }
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
            `specification ${filePath} generated`
          );
        } catch (err) {
          vscode.window.showErrorMessage(`File write failed: ${String(err)}`);
        }
      }
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      "Generate specification failed: " + String(err)
    );
  }
}
