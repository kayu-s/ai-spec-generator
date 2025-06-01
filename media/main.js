//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();
  const saveButton = document.getElementById("saveButton");
  const resetButton = document.getElementById("resetButton");
  if (!saveButton || !resetButton) {
    return;
  }
  saveButton.addEventListener("click", () => {
    // @ts-ignore
    const promptInput = document.getElementById("prompt")?.value;
    vscode.postMessage({ command: "savePrompt", text: promptInput });
  });

  resetButton.addEventListener("click", () => {
    // @ts-ignore
    vscode.postMessage({ command: "resetPrompt" });
  });
})();
