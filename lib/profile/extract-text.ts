// Turn an uploaded resume file into plain text. Runs on the server only.
export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return value;
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return new TextDecoder().decode(buf);
  }
  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT file, or paste the text.");
}
