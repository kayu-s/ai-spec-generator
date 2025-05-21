//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();
  const saveButton = document.getElementById("saveButton");
  if (!saveButton) return;
  saveButton.addEventListener("click", () => {
    // @ts-ignore
    const promptInput = document.getElementById("prompt")?.value;
    vscode.postMessage({ command: "savePrompt", text: promptInput });
  });
})();
