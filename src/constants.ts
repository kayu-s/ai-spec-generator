export const DEFAULT_PROMPT = {
  en: `Please generate documentation for all code within the project.
    - For each function, include the following: a brief description of the function’s purpose, descriptions of the function’s arguments and return values.
    - Use Markdown format.
    - Describe the processing flow using Mermaid syntax.
    `,
  ja: `Project内にある全コードに対し、仕様書を作成してください。
    ・仕様書は、各関数の説明と、関数の引数、戻り値を記載する。
    ・関数の説明は、関数の役割を簡潔に説明する。
    ・markdown形式で記載する。
    ・処理フローをmermaid形式で記載する。
    `,
};

export const EXTENSION_NAME = "ai-spec-generator";
