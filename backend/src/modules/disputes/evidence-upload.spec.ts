import { describe, expect, it } from "vitest";
import { EVIDENCE_MAX_BYTES, isPdf, validateEvidenceFile } from "./evidence-upload";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj");
const SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"/>`);

describe("validateEvidenceFile (kyc-style: images + pdf, SVG impossible)", () => {
  it("accepts jpeg and pdf", () => {
    const image = validateEvidenceFile(JPEG.toString("base64"));
    expect(image.ok).toBe(true);
    if (image.ok) expect(image.file.mime).toBe("image/jpeg");

    const pdf = validateEvidenceFile(PDF.toString("base64"));
    expect(pdf.ok).toBe(true);
    if (pdf.ok) {
      expect(pdf.file.mime).toBe("application/pdf");
      expect(pdf.file.ext).toBe(".pdf");
    }
  });

  it("rejects SVG, malformed base64, and files over the 5MB cap", () => {
    expect(validateEvidenceFile(SVG.toString("base64")).ok).toBe(false);
    expect(validateEvidenceFile("!!bad!!").ok).toBe(false);
    const overCap = Buffer.concat([PDF, Buffer.alloc(EVIDENCE_MAX_BYTES - PDF.length + 1)]);
    const result = validateEvidenceFile(overCap.toString("base64"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("5MB");
  });

  it("isPdf matches only a real %PDF- header", () => {
    expect(isPdf(PDF)).toBe(true);
    expect(isPdf(Buffer.from("PDF-1.4"))).toBe(false);
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });
});
