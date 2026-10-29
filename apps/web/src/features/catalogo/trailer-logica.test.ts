import { describe, expect, it } from "vitest";
import { claveYoutube, urlEmbebida } from "./trailer-logica";

describe("claveYoutube", () => {
  it("saca la clave de los formatos habituales de YouTube", () => {
    expect(claveYoutube("https://www.youtube.com/watch?v=abc123xyz")).toBe("abc123xyz");
    expect(claveYoutube("https://youtu.be/abc123xyz")).toBe("abc123xyz");
    expect(claveYoutube("https://m.youtube.com/watch?v=abc123xyz&t=10")).toBe("abc123xyz");
    expect(claveYoutube("https://www.youtube.com/embed/abc123xyz")).toBe("abc123xyz");
  });

  it("rechaza otros sitios, enlaces mal formados y claves no válidas", () => {
    expect(claveYoutube("https://vimeo.com/abc123xyz")).toBeNull();
    expect(claveYoutube("no es un enlace")).toBeNull();
    expect(claveYoutube("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(claveYoutube("https://www.youtube.com/")).toBeNull();
  });
});

describe("urlEmbebida", () => {
  it("usa el dominio sin cookies de YouTube", () => {
    expect(urlEmbebida("abc123xyz")).toBe("https://www.youtube-nocookie.com/embed/abc123xyz");
  });
});
