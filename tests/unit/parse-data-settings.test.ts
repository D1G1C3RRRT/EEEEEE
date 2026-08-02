import { describe, expect, it } from "vitest";
import { parseDataSettings } from "@/lib/blueprint/wordpress-jetengine";

/** Build HTML entities without putting literal entity sequences in source. */
const ent = {
  amp: () => "&" + "amp;",
  quot: () => "&" + "quot;",
  apos: () => "&" + "apos;",
};

describe("parseDataSettings", () => {
  it("parses plain JSON object", () => {
    expect(parseDataSettings('{"post_type":"aplikacie","x":1}')).toEqual({
      post_type: "aplikacie",
      x: 1,
    });
  });

  it("returns empty object or null for empty/invalid input", () => {
    expect(parseDataSettings("{}")).toEqual({});
    expect(parseDataSettings("")).toBeNull();
    expect(parseDataSettings("   ")).toBeNull();
    expect(parseDataSettings(null)).toBeNull();
    expect(parseDataSettings(undefined)).toBeNull();
    expect(parseDataSettings("[1,2]")).toBeNull();
    expect(parseDataSettings("not-json")).toBeNull();
  });

  it("decodes named quot entities used in Elementor attributes", () => {
    const q = ent.quot();
    const encoded = `{${q}dynamic_field_source${q}:${q}object_meta${q},${q}dynamic_field_post_meta${q}:${q}cena${q}}`;
    expect(parseDataSettings(encoded)).toEqual({
      dynamic_field_source: "object_meta",
      dynamic_field_post_meta: "cena",
    });
  });

  it("decodes double-encoded amp+quot sequences", () => {
    const aq = ent.amp() + "quot;";
    const encoded = `{${aq}post_type${aq}:${aq}aplikacie${aq}}`;
    expect(parseDataSettings(encoded)).toEqual({ post_type: "aplikacie" });
  });

  it("decodes numeric quote entities", () => {
    // &#34; and &#039; built at runtime
    const d34 = "&#" + "34;";
    const d39 = "&#" + "039;";
    const raw = `{${d34}a${d34}:${d34}O${d39}Brien${d34}}`;
    expect(parseDataSettings(raw)).toEqual({ a: "O'Brien" });
  });

  it("decodes apos entity inside string values", () => {
    const apos = ent.apos();
    const raw = `{"name":"O${apos}Neil"}`;
    const result = parseDataSettings(raw);
    expect(result).toEqual({ name: "O'Neil" });
  });

  it("handles backslash-escaped quotes", () => {
    expect(parseDataSettings('{\\"k\\":\\"v\\"}')).toEqual({ k: "v" });
  });

  it("extracts JSON object from surrounding junk", () => {
    expect(parseDataSettings('prefix {"ok":true} suffix')).toEqual({ ok: true });
  });

  it("trims whitespace", () => {
    expect(parseDataSettings('  \n{"a":2}\n  ')).toEqual({ a: 2 });
  });

  it("parses listing and dynamic field settings from fixtures", () => {
    expect(
      parseDataSettings('{"post_type":"aplikacie","lisitng_post_type":"aplikacie"}'),
    ).toMatchObject({ post_type: "aplikacie" });
    expect(
      parseDataSettings(
        '{"dynamic_field_source":"object_title","selected_dynamic_field":"title"}',
      ),
    ).toMatchObject({ dynamic_field_source: "object_title" });
  });
});
