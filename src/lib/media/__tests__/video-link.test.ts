import { describe, expect, it } from "vitest";
import { parseLoomLink, validateLoomLink } from "../loom-link";

describe("candidate video links", () => {
  it("accepts a Loom share link and derives the embed", () => {
    expect(parseLoomLink("https://www.loom.com/share/0123456789abcdef0123")).toMatchObject({
      provider: "loom",
      url: "https://www.loom.com/share/0123456789abcdef0123",
      embedUrl: "https://www.loom.com/embed/0123456789abcdef0123",
    });
  });

  it("accepts a Google Drive file link in its usual shapes", () => {
    const id = "1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-";
    for (const raw of [
      `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      `https://drive.google.com/file/d/${id}/view`,
      `https://drive.google.com/file/d/${id}/preview`,
      `https://drive.google.com/file/d/${id}`,
      `drive.google.com/open?id=${id}`,
      `https://drive.google.com/uc?id=${id}&export=download`,
    ]) {
      expect(parseLoomLink(raw)).toEqual({
        id,
        provider: "drive",
        url: `https://drive.google.com/file/d/${id}/view`,
        embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      });
    }
  });

  it("refuses other hosts, Drive folders and script payloads", () => {
    for (const raw of [
      "https://www.youtube.com/watch?v=abc",
      "https://drive.google.com/drive/folders/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-",
      "https://docs.google.com/document/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/edit",
      "https://drive.google.com.evil.example/file/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/view",
      "javascript:alert(1)",
      "https://www.loom.com/",
    ]) {
      expect(parseLoomLink(raw)).toBeNull();
    }
    expect(validateLoomLink("https://example.com/video")).toMatchObject({ link: null });
    expect(validateLoomLink("")).toEqual({ link: null, error: null });
  });
});
